import { AttributeValue, Context, DynamoDBStreamEvent } from "aws-lambda";
import { ApiGatewayManagementApi, DynamoDB, EventBridge } from "aws-sdk";
import { InvoiceWSService } from "/opt/nodejs/invoiceWSConnection";
import * as AWSXray from "aws-xray-sdk"

AWSXray.captureAWS(require("aws-sdk"))


const eventsDdb = process.env.EVENT_DDB!
const invoiceWSApiEndpoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6)
const AUDIT_BUS_NAME = process.env.AUDIT_BUS_NAME!

const ddbClient = new DynamoDB.DocumentClient()
const apigwManagementApi = new ApiGatewayManagementApi({
    endpoint: invoiceWSApiEndpoint
})
const eventBridgeClient = new EventBridge()
const invoiceWSService = new InvoiceWSService(apigwManagementApi)

export async function handler(event: DynamoDBStreamEvent, contexto: Context): Promise<void> {

    const promises: Promise<void> [] = []
    event.Records.forEach((record) => {
        
        if(record.eventName === 'INSERT'){
            if(record.dynamodb!.NewImage!.pk.S!.startsWith('#transaction')){
                console.log('Invoice transaction event received')
            } else {
                console.log('Invoice event received')
                promises.push(createEvent(record.dynamodb!.NewImage!,"INVOICE_CREATED"))
            }
        }else if(record.eventName === 'MODIFY'){

        }else if(record.eventName === 'REMOVE'){
            if(record.dynamodb!.OldImage!.pk.S === '#transaction'){
                console.log('Invoice transaction event received')
                promises.push(processExpiredTransaction(record.dynamodb!.OldImage!))
            }

        }
        
    })
    await Promise.all(promises)
    return 
}

async function createEvent(invoiceImage: {[key: string]: AttributeValue}, eventType: String) {
    const timestamp = Date.now()
    const ttl = ~~(timestamp / 1000 + 60 * 60)
    await ddbClient.put({
        TableName: eventsDdb,
        Item: {
            pk:`#invoice_${invoiceImage.sk.S}`,
            sk: `${eventType}#${timestamp}`,
            ttl: ttl,
            email: invoiceImage.pk.S!.split('_')[1],
            createdAt: timestamp,
            eventType: eventType,
            info: {
                transaction: invoiceImage.transactionId.S!,
                productId: invoiceImage.productId.S,
                quantity: invoiceImage.quantity.N
            }
        }
    }).promise()

    return 
}

async function processExpiredTransaction(invoiceTransactionImage: {[key: string]: AttributeValue}): Promise<void> {
    const transactionId = invoiceTransactionImage.sk.S!
    const connectionId = invoiceTransactionImage.connectionId.S!

    console.log(`Transaction id: ${transactionId} - ConnectId: ${connectionId}`)
    if(invoiceTransactionImage.transactionStatus.S === 'INVOICE_PROCESSED'){
        console.log('Invoice Processed')
    }else{
        console.log(`Invoice import failed - Status ${invoiceTransactionImage.transactionStatus.S}`)
        const putEventsPromise = eventBridgeClient.putEvents(
            {
                Entries: [
                    {
                        Source: 'app.invoice',
                        EventBusName: AUDIT_BUS_NAME,
                        DetailType: 'invoice',
                        Time: new Date(),
                        Detail: JSON.stringify({
                            reason: 'TIMEOUT'
                        })
                    }
                ]
            }    
        ).promise()
        
        const sendInvoicesStatusPromise = invoiceWSService.sendInvoiceStatus(transactionId, connectionId, 'TIMEOUT')
        
        await Promise.all([putEventsPromise, sendInvoicesStatusPromise ])
        await invoiceWSService.disconnectClient(connectionId)

        
    }
    
}