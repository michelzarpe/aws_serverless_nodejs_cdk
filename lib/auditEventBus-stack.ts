import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from "aws-cdk-lib/aws-ssm"
import * as sns from "aws-cdk-lib/aws-sns"
import * as subs from "aws-cdk-lib/aws-sns-subscriptions"
import * as events from "aws-cdk-lib/aws-events"
import * as targets from "aws-cdk-lib/aws-events-targets"
import * as sqs from "aws-cdk-lib/aws-sqs"
import * as logs from "aws-cdk-lib/aws-logs"
import * as cw from "aws-cdk-lib/aws-cloudwatch"
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions"
import * as lambdaEventSource from "aws-cdk-lib/aws-lambda-event-sources"
import { Construct } from 'constructs'


export class AuditEventBusStack extends cdk.Stack {
    readonly bus: events.EventBus
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        this.bus = new events.EventBus(this, "AuditEventBus", {
            eventBusName: "AuditEventBus"
        })

        this.bus.archive('BusArchive', {
            eventPattern: {
                source: ['app.order']
            },
            archiveName: "auditEvents",
            retention: cdk.Duration.days(10)
        })

        // source: app.order
        // detailType: order
        // reason: PRODUCT_NOT_FOUND
        const nonValidOrderRule = new events.Rule(this, "NonValidOrderRule",{
            ruleName: "NonValidOrderRule",
            description: "Rule matching non valid order",
            eventBus: this.bus,
            eventPattern: {
                source: ['app.order'],
                detailType: ['order'],
                detail: {
                    reason: ['PRODUCT_NOT_FOUND']
                }
            }
        })
        //target

        const ordersErrorsFunction = new lambdaNodeJs.NodejsFunction(this, 
            "OrdersErrorsFunction",{
                functionName:"OrdersErrorsFunction",
                entry: "lambda/audit/ordersErrosFunction/ordersErrorsFunction.ts",
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
            
            nonValidOrderRule.addTarget(new targets.LambdaFunction(ordersErrorsFunction))

        // source: app.invoice
        // detailType: invoice
        // reason: FAIL_NO_INVOICE_NUMBER
        const nonValidiInvoiceRule = new events.Rule(this, "NonValidiInvoiceRule",{
            ruleName: "NonValidiInvoiceRule",
            description: "Rule matching non valid invoice",
            eventBus: this.bus,
            eventPattern: {
                source: ['app.invoice'],
                detailType: ['invoice'],
                detail: {
                    reason: ['FAIL_NO_INVOICE_NUMBER']
                }
            }
        })
        //target

        const invoicesErrorsFunction = new lambdaNodeJs.NodejsFunction(this, 
            "InvoicesErrorsFunction",{
                functionName:"InvoicesErrorsFunction",
                entry: "lambda/audit/invoicesErrorsFunction/invoicesErrorsFunction.ts",
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
            
            nonValidiInvoiceRule.addTarget(new targets.LambdaFunction(invoicesErrorsFunction))


        // source: app.invoice
        // detailType: invoice
        // reason: TIMEOUT
        const timeoutImportInvoiceRule = new events.Rule(this, "TimeoutImportInvoiceRule",{
            ruleName: "TimeoutImportInvoiceRule",
            description: "Rule matching timeout import invoice",
            eventBus: this.bus,
            eventPattern: {
                source: ['app.invoice'],
                detailType: ['invoice'],
                detail: {
                    reason: ['TIMEOUT']
                }
            }
        })
        //target
        const invoiceImportTimeoutQueue = new sqs.Queue(this, 'InvoiceImportTimeOut', {
            queueName: 'invoice-import-timeout'
        })

        timeoutImportInvoiceRule.addTarget(new targets.SqsQueue(invoiceImportTimeoutQueue))

        //metrica
        const numberOfMessagesMetrick = invoiceImportTimeoutQueue.metricApproximateNumberOfMessagesVisible({
            period: cdk.Duration.minutes(2),
            statistic: "Sum"
        })
        //alarm
        numberOfMessagesMetrick.createAlarm(this, "InvoiceImportTimeoutAlarm",{
            alarmDescription: "alguma descrição",
            evaluationPeriods: 1,
            threshold: 5,
            actionsEnabled: false,
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            alarmName: "InvoiceImportTimeoutAlarm"
        })
     
        const ageOfMessageMetric = invoiceImportTimeoutQueue.metricApproximateAgeOfOldestMessage({
            period: cdk.Duration.minutes(2),
            statistic: 'Maximum',
            unit: cw.Unit.SECONDS
        })

        ageOfMessageMetric.createAlarm(this, "AgeOfMessageInQueue",{
            alarmName: "AgeOfMesagesInQueue",
            actionsEnabled: false,
            evaluationPeriods: 1,
            threshold: 60,
            comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
        })

    }
}