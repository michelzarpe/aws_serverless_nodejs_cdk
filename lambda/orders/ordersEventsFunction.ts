import { Context, SNSEvent, SNSMessage } from "aws-lambda"
import { Product, ProductRepository } from "/opt/nodejs/productsLayer"
import { AWSError, DynamoDB, SNS } from "aws-sdk"
import * as AWSXray from "aws-xray-sdk"
import { Order, OrderRepository } from "./layers/ordersLayer/nodejs/orderRepository"
import { CarrierType, OrderProductResponse, OrderRequest, OrderResponse, PaymentType, ShippingType } from "/opt/nodejs/ordersApiLayer"
import { OrderEvent, OrderEventType, Envelope } from '/opt/nodejs/orderEventsLayer'
import { OrderEventDdb, OrderEventRepository } from "/opt/nodejs/orderEventsRepositoryLayer"
import { PromiseResult } from "aws-sdk/lib/request"

AWSXray.captureAWS(require("aws-sdk"))

const EVENTS_DDB = process.env.EVENTS_DDB!

const ddbClient = new DynamoDB.DocumentClient()

const ordersEventRepository = new OrderEventRepository(ddbClient,EVENTS_DDB)


export async function handler(event: SNSEvent, context: Context): Promise<void> {

    const promises: Promise<PromiseResult<DynamoDB.DocumentClient.PutItemOutput, AWSError>>[] = []

    event.Records.forEach((record)=>{
        promises.push(createEvent(record.Sns))
    })

    await Promise.all(promises)

    return 
}

function createEvent(body: SNSMessage){

    const envelop = JSON.parse(body.Message) as Envelope
    
    const event = JSON.parse(envelop.data) as OrderEvent

    console.log(`Order event - MessageId: ${body.MessageId}`)
    
    const timestamp = Date.now()

    const ttl = ~~(timestamp/1000 + 5 * 60)
    
    const orderEventDdb: OrderEventDdb = {
        pk: `#order_${event.orderId}`,
        sk: `${envelop.eventType}#${timestamp}`,
        ttl: ttl,
        email: event.email,
        createdAt: timestamp,
        requestId: event.requestId,
        eventType: envelop.eventType,
        info: {
            orderId: event.orderId,
            productCodes: event.productCodes,
            messageId: body.MessageId
        }
    }

    return ordersEventRepository.createOrderEvent(orderEventDdb)
}