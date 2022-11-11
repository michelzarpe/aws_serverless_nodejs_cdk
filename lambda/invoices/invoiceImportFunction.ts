import { APIGatewayProxyEvent, APIGatewayProxyResult, Context, S3Event, S3EventRecord } from "aws-lambda"
import { ApiGatewayManagementApi, DynamoDB, EventBridge, S3 } from "aws-sdk"
import * as AWSXray from "aws-xray-sdk"
import {v4 as uuid} from "uuid"
import { InvoiceFile, InvoiceRepository } from "/opt/nodejs/invoiceRepository"
import {InvoiceTransactionStatus, InvoiceTransactionRepository } from '/opt/nodejs/invoiceTransaction'
import { InvoiceWSService } from "/opt/nodejs/invoiceWSConnection"

AWSXray.captureAWS(require("aws-sdk"))

const invoicesDdb = process.env.INVOICE_DDB!
const invoicesWsApiEndPoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6)
const AUDIT_BUS_NAME = process.env.AUDIT_BUS_NAME!

const s3Client = new S3()
const dbClient = new DynamoDB.DocumentClient()
const apiGwManagementApi = new ApiGatewayManagementApi({
    endpoint: invoicesWsApiEndPoint
})
const eventBridgeClient = new EventBridge()

const invoiceTransactionRepository = new InvoiceTransactionRepository(dbClient,invoicesDdb)
const invoiceWSService = new InvoiceWSService(apiGwManagementApi)
const invoiceRepository = new InvoiceRepository(dbClient,invoicesDdb)

export async function handler(event: S3Event, context: Context): Promise<void> {

    const promises: Promise<void>[]=[]

    console.log(event)

    event.Records.forEach((record)=>{
        promises.push(processRecord(record))
    })

    await Promise.all(promises)

}


async function processRecord(record: S3EventRecord): Promise<void> {
    const key = record.s3.object.key


    try {
        const invoiceTransaction = await invoiceTransactionRepository.getInvoiceTransaction(key)
        if(invoiceTransaction.transactionStatus == InvoiceTransactionStatus.GENERATED){
            await Promise.all([invoiceWSService.sendInvoiceStatus(invoiceTransaction.sk, invoiceTransaction.connectionId, InvoiceTransactionStatus.RECEIVED),
            invoiceTransactionRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.RECEIVED)])

        }else {
            await invoiceWSService.sendInvoiceStatus(invoiceTransaction.sk, invoiceTransaction.connectionId, invoiceTransaction.transactionStatus)
            console.error("non valid transaction status")
            return 
        }

        const objet = await s3Client.getObject({
            Key:key,
            Bucket: record.s3.bucket.name
        }).promise()
        const invoice = JSON.parse(objet.Body!.toString('utf-8'))  as InvoiceFile
        console.log(invoice)

        if(invoice.invoiceNumber.length >=5){
            const createInvoicePromisse = invoiceRepository.create({
                pk: `#invoice_${invoice.customerName}`,
                sk: invoice.invoiceNumber,
                ttl: 0,
                totalValue: invoice.totalValue,
                productId: invoice.productId,
                quantity: invoice.quantity,
                transactionId: key,
                createdAt: Date.now()
            })
            const deleteObjectPromise = s3Client.deleteObject({
                Key: key,
                Bucket: record.s3.bucket.name
            }).promise()
            const updateInvoicePromisse = await invoiceTransactionRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.PROCESSD)
            const sendStatusPromisse = invoiceWSService.sendInvoiceStatus(key, invoiceTransaction.connectionId, InvoiceTransactionStatus.PROCESSD)
            await Promise.all([createInvoicePromisse, deleteObjectPromise, updateInvoicePromisse, sendStatusPromisse])
        }else {
            console.error(`invoice import failed - non valid invoice number -TransationId: ${key}`)
            const putEventPromise = eventBridgeClient.putEvents(
                {
                    Entries: [
                        {
                            Source: 'app.invoice',
                            EventBusName: AUDIT_BUS_NAME,
                            DetailType: 'invoice',
                            Time: new Date(),
                            Detail: JSON.stringify({
                                reason: 'FAIL_NO_INVOICE_NUMBER'
                            })
                        }
                    ]
                }    
            ).promise()
            const sendStatusPromise = invoiceWSService.sendInvoiceStatus(key,invoiceTransaction.connectionId, InvoiceTransactionStatus.NON_VALID_INVOICE_NUMBER)
            const updateInvoicePromise = invoiceTransactionRepository.updateInvoiceTransaction(key, InvoiceTransactionStatus.NON_VALID_INVOICE_NUMBER)
            await Promise.all([sendStatusPromise, updateInvoicePromise, putEventPromise])
        }
        await invoiceWSService.disconnectClient(invoiceTransaction.connectionId)
    } catch (error) {
        console.log((<Error>error).message)
    }

}