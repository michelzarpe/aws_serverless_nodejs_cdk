import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import { Construct } from 'constructs'
import * as dynadb from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from "aws-cdk-lib/aws-ssm"
import * as iam from "aws-cdk-lib/aws-iam"
import * as sqs from "aws-cdk-lib/aws-sqs"

interface ProductsAppStackProps extends cdk.StackProps {
    eventsDdb: dynadb.Table
}

export class ProductsAppStack extends cdk.Stack {

readonly productsFetchHandler: lambdaNodeJs.NodejsFunction
readonly productsAdminHandler: lambdaNodeJs.NodejsFunction

readonly productsDdb: dynadb.Table


    constructor(scope: Construct, id: string, props: ProductsAppStackProps){
        super(scope,id,props)

        // constuindo tabela no dynamo
        this.productsDdb = new dynadb.Table(this, "ProductsDdb", {
            tableName: "products",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: "id",
                type: dynadb.AttributeType.STRING
            },
            billingMode: dynadb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })


        //criar layer de product
        const productsLayersArn = ssm.StringParameter.valueForStringParameter(this, "ProductsLayerVersionArn")
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "ProductsLayerVersionArn",productsLayersArn)

        //criando layer de product events
        const productEventsLayersArn = ssm.StringParameter.valueForStringParameter(this, "ProductEventsLayerVersionArn")
        const productEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "ProductEventsLayerVersionArn",productEventsLayersArn)

        //auth user infor layer
        const authUserInfoLayerArn = ssm.StringParameter.valueForStringParameter(this, "AuthUserInfoLayerVersionArn")
        const authUserInfoLayer = lambda.LayerVersion.fromLayerVersionArn(this, "AuthUserInfoLayerVersionArn", authUserInfoLayerArn)

        //criando dlq
        const dlq = new sqs.Queue(this, "ProductEventsDql", {
            queueName: "product-events-dlq",
            retentionPeriod: cdk.Duration.days(1)
        })

        //construindo funcao de productsEvents para acessar tabela de eventos
        const productEventsHandler = new lambdaNodeJs.NodejsFunction(this, 
            "ProductEventsFunction",{
                functionName:"ProductEventsFunction",
                entry: "lambda/products/productEventsFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(2),
                bundling: {
                    minify: true,
                    sourceMap: false      
                },
                environment: {
                    EVENTS_DDB: props.eventsDdb.tableName
                },
                layers: [productEventsLayer],
                deadLetterQueue: dlq,
                deadLetterQueueEnabled: true,
                tracing: lambda.Tracing.ACTIVE,
                insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
            })

            //inserindo permiss??o para o productEventsHandler poder gravar valores na tabela de events
            // props.eventsDdb.grantWriteData(productEventsHandler)

        //criando uma politica de acesso
        const eventsDdbPolice = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem"],
            resources: [props.eventsDdb.tableArn],
            conditions: {
                ['ForAllValues:StringLike']:{
                    'dynamodb:LeadingKeys': ['#product_*']
                }
            }
        })
        productEventsHandler.addToRolePolicy(eventsDdbPolice)   


            
        //construindo fun????o Fetch
        this.productsFetchHandler = new lambdaNodeJs.NodejsFunction(this, 
            "ProductsFetchFunction",{
                functionName:"ProductsFetchFunction",
                entry: "lambda/products/productsFetchFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(5),
                bundling: {
                   minify: true,
                   sourceMap: false      
                },
                environment: {
                    PRODUCTS_DDB: this.productsDdb.tableName
                },
                layers: [productsLayer],
                tracing: lambda.Tracing.ACTIVE,
                insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
            })

         //construindo fun????o Admin
        this.productsAdminHandler = new lambdaNodeJs.NodejsFunction(this, 
            "ProductsAdminFunction",{
                functionName:"ProductsAdminFunction",
                entry: "lambda/products/productsAdminFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(5),
                bundling: {
                   minify: true,
                   sourceMap: false      
                },
                environment: {
                    PRODUCTS_DDB: this.productsDdb.tableName,
                    PRODUCT_EVENTS_FUNCTION_NAME: productEventsHandler.functionName //acessar essa funcao 
                },
                layers: [productsLayer, productEventsLayer, authUserInfoLayer],
                tracing: lambda.Tracing.ACTIVE,
                insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
            })

        //inserindo permiss??o de leitura 
        this.productsDdb.grantReadData(this.productsFetchHandler)
        this.productsDdb.grantWriteData(this.productsAdminHandler)

        //inserindo permiss??o para que productsAdminHandler possa acessar productsEventsHandler
        productEventsHandler.grantInvoke(this.productsAdminHandler)
   

            
        
    }
}