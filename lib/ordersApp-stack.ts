import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from "aws-cdk-lib/aws-ssm"
import * as sns from "aws-cdk-lib/aws-sns"
import * as subs from "aws-cdk-lib/aws-sns-subscriptions"
import * as iam from "aws-cdk-lib/aws-iam"
import * as sqs from "aws-cdk-lib/aws-sqs"
import * as event from "aws-cdk-lib/aws-events"
import * as lambdaEventSource from "aws-cdk-lib/aws-lambda-event-sources"
import * as logs from "aws-cdk-lib/aws-logs"
import * as cw from "aws-cdk-lib/aws-cloudwatch"
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions"
import { Construct } from 'constructs'

interface OrdersAppStackProps extends cdk.StackProps {
    productsDdb: dynamodb.Table,
    eventDdb: dynamodb.Table,
    auditBus: event.EventBus
}

export class OrdersAppStack extends cdk.Stack {

    readonly ordersDdb: dynamodb.Table
    readonly ordersHandler: lambdaNodeJs.NodejsFunction
    readonly orderEventsFetchHandler: lambdaNodeJs.NodejsFunction


    constructor(scope: Construct, id: string, props: OrdersAppStackProps){
        super(scope,id,props)

        // constuindo tabela no dynamo
        this.ordersDdb = new dynamodb.Table(this, "OrdersDdb", {
            tableName: "orders",
            removalPolicy: cdk.RemovalPolicy.DESTROY,

            partitionKey: {
                name: "pk",
                type: dynamodb.AttributeType.STRING
            },
            sortKey:{
                name: "sk",
                type: dynamodb.AttributeType.STRING
            },


            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })

        const writeThottleEventsMetric = this.ordersDdb.metric('WriteThroleEvents', {
            period: cdk.Duration.minutes(2),
            statistic: "SampleCount",
            unit: cw.Unit.COUNT
        })

        writeThottleEventsMetric.createAlarm(this, 'WriteThottleEventsAlarm', {
            alarmName: "WriteThrottleEvents",
            actionsEnabled: false, 
            evaluationPeriods: 1,
            threshold: 25, 
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: cw.TreatMissingData.NOT_BREACHING
        })

        //orders layer
        const ordersLayersArn = ssm.StringParameter.valueForStringParameter(this, "OrdersLayerVersionArn")
        const ordersLayer = lambda.LayerVersion.fromLayerVersionArn(this, "OrdersLayerVersionArn",ordersLayersArn)

        //products layer
        const productsLayersArn = ssm.StringParameter.valueForStringParameter(this, "ProductsLayerVersionArn")
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "ProductsLayerVersionArn",productsLayersArn)

        //orders API layer
        const ordersApiLayersArn = ssm.StringParameter.valueForStringParameter(this, "OrdersApiLayerVersionArn")
        const ordersApiLayer = lambda.LayerVersion.fromLayerVersionArn(this, "OrdersApiLayerVersionArn",ordersApiLayersArn)

        //orders event layer
        const ordersEventLayersArn = ssm.StringParameter.valueForStringParameter(this, "OrderEventsLayerArn")
        const ordersEventLayer = lambda.LayerVersion.fromLayerVersionArn(this, "OrderEventsLayerArn",ordersEventLayersArn)

        //orders event Repository layer
        const ordersEventRepositoryLayersArn = ssm.StringParameter.valueForStringParameter(this, "OrderEventsRepositoryLayerArn")
        const ordersEventRepositoryLayer = lambda.LayerVersion.fromLayerVersionArn(this, "OrderEventsRepositoryLayerArn", ordersEventRepositoryLayersArn)

        //auth user infor layer
        const authUserInfoLayerArn = ssm.StringParameter.valueForStringParameter(this, "AuthUserInfoLayerVersionArn")
        const authUserInfoLayer = lambda.LayerVersion.fromLayerVersionArn(this, "AuthUserInfoLayerVersionArn", authUserInfoLayerArn)

        const ordersTopic = new sns.Topic(this, "OrderEventTopic",{
            displayName: "OrderEventTopic",
            topicName:"order-events"
        })

         //construindo fun????o ordersHandler
         this.ordersHandler = new lambdaNodeJs.NodejsFunction(this, 
            "OrdersFunction",{
                functionName:"OrdersFunction",
                entry: "lambda/orders/ordersFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(2),
                bundling: {
                   minify: true,
                   sourceMap: false      
                },
                environment: {
                    ORDERS_DDB: this.ordersDdb.tableName, 
                    PRODUCTS_DDB: props.productsDdb.tableName,
                    ORDER_EVENTS_TOPIC_ARN: ordersTopic.topicArn,
                    AUDIT_BUS_NAME: props.auditBus.eventBusName
                },
                layers: [productsLayer, ordersLayer, ordersApiLayer, ordersEventLayer, authUserInfoLayer],
                tracing: lambda.Tracing.ACTIVE
                //insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
            })

        //inserindo permiss??o de leitura 
        this.ordersDdb.grantReadWriteData(this.ordersHandler)
        props.productsDdb.grantReadData(this.ordersHandler)
        ordersTopic.grantPublish(this.ordersHandler)
        props.auditBus.grantPutEventsTo(this.ordersHandler)

        //metrica
        const productNotFoundMetricFilter = this.orderEventsFetchHandler.logGroup.addMetricFilter('ProductNotFoundMetric', {
            metricName: "OrderWithNonValidProduct",
            metricNamespace: "ProductNotFound",
            filterPattern: logs.FilterPattern.literal('Some product was not found')
        })
        //alarm
        const produtctNotFoundAlarm = productNotFoundMetricFilter
            .metric()
            .with({
                statistic: 'Sum',
                period: cdk.Duration.minutes(2)
            })
            .createAlarm(this, 'ProductNotFaundAlarm', {
                alarmName: 'OrderWithNonValidProduct',
                alarmDescription: "alguma descri????o",
                evaluationPeriods: 1,
                threshold: 2,
                actionsEnabled: true,
                comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
            })
        //action
            const orderAlarmsTopic = new sns.Topic(this, "OrdersAlarmsTopic", {
                displayName: "order alarmas topic",
                topicName: "order-alarms"
            })

            orderAlarmsTopic.addSubscription(new subs.EmailSubscription('colocaremail@algumacoisa.com'))

            produtctNotFoundAlarm.addAlarmAction(new cw_actions.SnsAction(orderAlarmsTopic))

        //construindo funcao orderEvents
        const orderEventsHandler = new lambdaNodeJs.NodejsFunction(this, "OrdersEventsFunction",{
                functionName:"OrdersEventsFunction",
                entry: "lambda/orders/ordersEventsFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(2),
                bundling: {
                   minify: true,
                   sourceMap: false      
                },
                environment: {
                    EVENTS_DDB: props.eventDdb.tableName
                },
                layers: [ordersEventLayer, ordersEventRepositoryLayer],
                tracing: lambda.Tracing.ACTIVE,
                insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
            })
        ordersTopic.addSubscription(new subs.LambdaSubscription(orderEventsHandler)) //se inscrevendo para receber a mensagem    
 
        //criando uma politica de acesso
        const eventsDdbPolice = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem"],
            resources: [props.eventDdb.tableArn],
            conditions: {
                ['ForAllValues:StringLike']:{
                    'dynamodb:LeadingKeys': ['#order_*']
                }
            }
        })
        orderEventsHandler.addToRolePolicy(eventsDdbPolice)

        //construindo funcao paymant
        const paymentHandler = new lambdaNodeJs.NodejsFunction(this, "PaymentFunction",{
                functionName:"PaymentFunction",
                entry: "lambda/payment/paymentFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(2),
                bundling: {
                   minify: true,
                   sourceMap: false      
                },
                tracing: lambda.Tracing.ACTIVE,
                insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
            })

        //RECEBE APENAS ORDER CREATED PARA ESSA FUNCAO LAMBDA
        ordersTopic.addSubscription(new subs.LambdaSubscription(paymentHandler,{
            filterPolicy: {
                eventType: sns.SubscriptionFilter.stringFilter({
                    allowlist: ['ORDER_CREATED']
                })
            }
        })) //se inscrevendo para receber a mensagem      

        
        //criando fila de DLQ
        const orderEventsDLQ = new sqs.Queue(this, "OrderEventsDLQ",{ 
            queueName: "order-events-dlq",
            retentionPeriod: cdk.Duration.days(10)
        })

        //criando fila
        const orderEventQueue = new sqs.Queue(this, "OrderEventsQueue",{ 
            queueName: "order-events",
            deadLetterQueue: {
                maxReceiveCount: 2,
                queue: orderEventsDLQ
            }
        })

        ordersTopic.addSubscription(new subs.SqsSubscription(orderEventQueue,{
            filterPolicy: {
                eventType: sns.SubscriptionFilter.stringFilter({
                    allowlist: ['ORDER_CREATED']
                })
            }
        }))
        
        //construindo funcao envio demail
        const orderEmailsHandler = new lambdaNodeJs.NodejsFunction(this, "OrderEmailsHandler",{
            functionName:"OrderEmailsHandler",
            entry: "lambda/orders/orderEmailsFunction.ts",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
            minify: true,
            sourceMap: false      
            },
            tracing: lambda.Tracing.ACTIVE,
            layers: [ordersEventLayer],
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
        })

        // dizer que a fonte de eventos do order emails handler ?? orderEventQueue
        orderEmailsHandler.addEventSource(new lambdaEventSource.SqsEventSource(orderEventQueue.{
            batchSize: 5,
            enabled: true,
            maxBatchingWindow: cdk.Duration.minutes(1)
        }))

        orderEventQueue.grantConsumeMessages(orderEmailsHandler) //Dizer para o orderEventQueue que o order EmaislHandler pode consumir
        
        const orderEmailSesPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["ses:SendEmail","ses:SendRawEmail"],
            resources: ["*"]
        })

        orderEmailsHandler.addToRolePolicy(orderEmailSesPolicy)

        this.orderEventsFetchHandler = new lambdaNodeJs.NodejsFunction(this, "OrderEventsFetchFunction",{
            functionName:"OrderEventsFetchaFunction",
            entry: "lambda/orders/orderEventsFetchFunction.ts",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
            minify: true,
            sourceMap: false      
            },
            environment: {
                EVENTS_DDB: props.eventDdb.tableName
            },
            tracing: lambda.Tracing.ACTIVE,
            layers: [ordersEventRepositoryLayer],
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
        })

        //permiss??o personalizada
        const eventsFethDdbPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:Query'],
            resources: [`${props.eventDdb.tableArn}/index/emailIndex`]
        })

        this.orderEventsFetchHandler.addToRolePolicy(eventsDdbPolice)

    }
}