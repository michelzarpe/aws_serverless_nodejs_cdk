import { APIGatewayProxyEvent, APIGatewayProxyResult, Context, S3Event, S3EventRecord } from "aws-lambda"
import { ApiGatewayManagementApi, DynamoDB, S3 } from "aws-sdk"
import * as AWSXray from "aws-xray-sdk"
import {v4 as uuid} from "uuid"
import { InvoiceFile, InvoiceRepository } from "/opt/nodejs/invoiceRepository"
import {InvoiceTransactionStatus, InvoiceTransactionRepository } from '/opt/nodejs/invoiceTransaction'
import { InvoiceWSService } from "/opt/nodejs/invoiceWSConnection"

AWSXray.captureAWS(require("aws-sdk"))

const invoicesDdb = process.env.INVOICE_DDB!
const invoicesWsApiEndPoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6)

const dbClient = new DynamoDB.DocumentClient()
const apiGwManagementApi = new ApiGatewayManagementApi({
    endpoint: invoicesWsApiEndPoint
})

const invoiceTransactionRepository = new InvoiceTransactionRepository(dbClient,invoicesDdb)
const invoiceWSService = new InvoiceWSService(apiGwManagementApi)


export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

    const transactionId = JSON.parse(event.body!).transactionId as string
    const lambdaRequestId = context.awsRequestId
    const connectionId = event.requestContext.connectionId!

    console.log(`Connection id: ${connectionId} - lambda: ${lambdaRequestId}`)

    try {
        const invoiceTransaction = await invoiceTransactionRepository.getInvoiceTransaction(transactionId)
        if(invoiceTransaction.transactionStatus === InvoiceTransactionStatus.GENERATED){
            await Promise.all([await invoiceWSService.sendInvoiceStatus(transactionId, connectionId, InvoiceTransactionStatus.CANCELLED),
            invoiceTransactionRepository.updateInvoiceTransaction(transactionId, InvoiceTransactionStatus.CANCELLED)])
        }else{
            await invoiceWSService.sendInvoiceStatus(transactionId, connectionId, invoiceTransaction.transactionStatus)
            console.error("Can't cancel an ongoing process")
        }
    } catch (error) {
        console.error((<Error>error).message)
        console.error(`invoice transaction not foud, transaction ${transactionId}`)
        await invoiceWSService.sendInvoiceStatus(transactionId, connectionId, InvoiceTransactionStatus.NON_VALID_INVOICE_NUMBER)
    }
    
    return {
        statusCode: 200,
        body: 'OK'
    }

}