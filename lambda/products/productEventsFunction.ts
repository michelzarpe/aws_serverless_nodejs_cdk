import { Callback, Context } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import { ProductEvent } from "/opt/nodejs/productEventsLayer";
import * as AWSRay from "aws-xray-sdk"

//configurando xray
AWSRay.captureAWS(require("aws-sdk"))
//importando variaveis de ambiente
const eventsDdb = process.env.EVENTS_DDB!
//cliente para acessar dynamo
const ddbClient = new DynamoDB.DocumentClient()

export async function handler(events: ProductEvent, context: Context, callback: Callback): Promise<void> {

    console.log(`Evento: ${events}`)

    console.log(`Lambda requestId: ${context.awsRequestId}`)

    await createEvent(events)
   
    callback(null, JSON.stringify({
        productEventCreated: true,
        message: "Ok"
    }))
}

function createEvent(event: ProductEvent) {
    
    const timestamp = Date.now()
    
    const ttl = ~~(timestamp / 1000 + 5 + 60)  // 5 minutos a frente
    
    ddbClient.put({
        TableName: eventsDdb,
        Item: {
            pk: `#product_${event.productCode}`,
            sk: `${event.eventType}#${timestamp}`,
            email: event.email,
            createdAt: timestamp,
            requestId: event.requestId,
            eventType: event.eventType,
            info: {
                productId: event.productId,
                price: event.productPrice
            },
            ttl: ttl
        }
    }).promise()
}