import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda"
import { DynamoDB } from "aws-sdk"
import * as AWSXray from "aws-xray-sdk"
import { OrderEventDdb, OrderEventRepository } from "/opt/nodejs/orderEventsRepositoryLayer"

AWSXray.captureAWS(require("aws-sdk"))

const EVENTS_DDB = process.env.EVENTS_DDB!

const ddbClient = new DynamoDB.DocumentClient()

const ordersEventRepository = new OrderEventRepository(ddbClient,EVENTS_DDB)


export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

    const email = event.queryStringParameters!.email!
    const eventType = event.queryStringParameters!.eventType
    
    if(eventType){
        const orderEvents = await ordersEventRepository.getOrderEventsByEmailAndEventsType(email, eventType)
        return {
            statusCode: 200,
            body: JSON.stringify(converteOrderEvents(orderEvents))
        }
    } else {
        const orderEvents = await ordersEventRepository.getOrderEventsByEmail(email)
        return {
            statusCode: 200,
            body: JSON.stringify(converteOrderEvents(orderEvents))
        }
    }
}

function converteOrderEvents(orderEvents: OrderEventDdb[]){
    return orderEvents.map((oE)=>{
        return {
            email: oE.email,
            createdAt: oE.createdAt,
            eventType: oE.eventType,
            requestId: oE.requestId,
            orderId: oE.info.orderId,
            productCodes: oE.info.productCodes
        }
    })
}