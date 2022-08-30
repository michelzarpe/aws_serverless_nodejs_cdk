import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from "aws-cdk-lib/aws-ssm"
import * as sns from "aws-cdk-lib/aws-sns"
import * as subs from "aws-cdk-lib/aws-sns-subscriptions"
import * as iam from "aws-cdk-lib/aws-iam"
import { Construct } from 'constructs'

interface OrdersAppStackProps extends cdk.StackProps {
    productsDdb: dynamodb.Table,
    eventDdb: dynamodb.Table
}

export class OrdersAppStack extends cdk.Stack {

    readonly ordersDdb: dynamodb.Table
    readonly ordersHandler: lambdaNodeJs.NodejsFunction


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




        const ordersTopic = new sns.Topic(this, "OrderEventTopic",{
            displayName: "OrderEventTopic",
            topicName:"order-events"
        })

         //construindo função ordersHandler
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
                    ORDER_EVENTS_TOPIC_ARN: ordersTopic.topicArn
                },
                layers: [productsLayer, ordersLayer, ordersApiLayer, ordersEventLayer],
                tracing: lambda.Tracing.ACTIVE,
                insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
            })

        //inserindo permissão de leitura 
        this.ordersDdb.grantReadWriteData(this.ordersHandler)
        props.productsDdb.grantReadData(this.ordersHandler)
        ordersTopic.grantPublish(this.ordersHandler)

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
    }
}