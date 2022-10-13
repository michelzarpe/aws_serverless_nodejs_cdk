import * as apigatewayv2 from "@aws-cdk/aws-apigatewayv2-alpha"
import * as apigatewayv2_integrations from "@aws-cdk/aws-apigatewayv2-integrations-alpha"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from "aws-cdk-lib/aws-ssm"
import * as s3 from "aws-cdk-lib/aws-s3"
import * as s3n from "aws-cdk-lib/aws-s3-notifications"
import * as sns from "aws-cdk-lib/aws-sns"
import * as subs from "aws-cdk-lib/aws-sns-subscriptions"
import * as iam from "aws-cdk-lib/aws-iam"
import * as sqs from "aws-cdk-lib/aws-sqs"
import * as lambdaEventSource from "aws-cdk-lib/aws-lambda-event-sources"
import { Construct } from 'constructs'

export class InvoiceWSApiStack extends cdk.Stack {


    constructor(scope: Construct, id: string, props: cdk.StackProps){
        super(scope,id,props)
    
    
    
        // tabela para invoice e transaction
        const invoicesDdb = new dynamodb.Table(this, "InvoiceDdb", {
            tableName: 'invoices',
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1,
            partitionKey: {
                name: "pk",
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: "sk",
                type: dynamodb.AttributeType.STRING
            },
            timeToLiveAttribute: "ttl",
            removalPolicy: cdk.RemovalPolicy.DESTROY
        })


        //invoice bucket
        const bucket = new s3.Bucket(this, "InvoiceBucket", {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            lifecycleRules: [
                {
                    enabled: true,
                    expiration: cdk.Duration.days(1)
                }

            ]
        })

        //WebSocket connection handler
                 //construindo função ordersHandler
         const connectionHandler = new lambdaNodeJs.NodejsFunction(this, 
            "InvoiceConnectFunction",{
                functionName:"InvoiceConnectFunction",
                entry: "lambda/invoices/invoiceConnectFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(2),
                bundling: {
                   minify: true,
                   sourceMap: false      
                },
                tracing: lambda.Tracing.ACTIVE
            })

        //WebSocket disconnection handler
        const disconnectionHandler = new lambdaNodeJs.NodejsFunction(this, 
            "InvoiceDisconnectionFunction",{
                functionName:"InvoiceDisconnectionFunction",
                entry: "lambda/invoices/invoiceDisconnectionFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(2),
                bundling: {
                   minify: true,
                   sourceMap: false      
                },
                tracing: lambda.Tracing.ACTIVE
            })

        //webSocket Api-gateway
        const webSocketApi = new apigatewayv2.WebSocketApi(this, "InvoiceWSApi", {
            apiName: "InvoiceWSApi",
            connectRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration("ConnectionHandler", connectionHandler)
            },
            disconnectRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration("DisconectionnHandler", disconnectionHandler)
            }
        })

        const stage = "prod"
        const wsApiEndpoint= `${webSocketApi.apiEndpoint}/${stage}`
        new apigatewayv2.WebSocketStage(this, "InvoiceWSApiStage",{
            webSocketApi: webSocketApi,
            stageName: stage,
            autoDeploy: true
        })

        //invoice url handler

        //invoice import handler

        //concel import handler

        //WebSocket Api routes

    }

}