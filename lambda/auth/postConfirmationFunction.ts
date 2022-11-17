import { APIGatewayProxyEvent, APIGatewayProxyResult, Callback, Context, S3Event, S3EventRecord } from "aws-lambda"
import { ApiGatewayManagementApi, DynamoDB, S3 } from "aws-sdk"
import * as AWSXray from "aws-xray-sdk"
import {v4 as uuid} from "uuid"
import { InvoiceFile, InvoiceRepository } from "/opt/nodejs/invoiceRepository"
import {InvoiceTransactionStatus, InvoiceTransactionRepository } from '/opt/nodejs/invoiceTransaction'
import { InvoiceWSService } from "/opt/nodejs/invoiceWSConnection"

AWSXray.captureAWS(require("aws-sdk"))

export async function handler(event: APIGatewayProxyEvent, context: Context, callBack: Callback): Promise<void> {
    console.log("postConfirmation")
    console.log(event)
    callBack(null, event)
}