import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda"
import { Product, ProductRepository } from "/opt/nodejs/productsLayer"
import { DynamoDB, SNS } from "aws-sdk"
import * as AWSXray from "aws-xray-sdk"
import { v4 as uuid } from "uuid"
import { Order, OrderRepository } from "./layers/ordersLayer/nodejs/orderRepository"
import { CarrierType, OrderProductResponse, OrderRequest, OrderResponse, PaymentType, ShippingType } from "/opt/nodejs/ordersApiLayer"
import { OrderEvent, OrderEventType, Envelope } from '/opt/nodejs/orderEventsLayer'


AWSXray.captureAWS(require("aws-sdk"))

const ORDERS_DDB = process.env.ORDERS_DDB!
const PRODUCTS_DDB = process.env.PRODUCTS_DDB!
const ORDER_EVENTS_TOPIC_ARN = process.env.ORDER_EVENTS_TOPIC_ARN!

const clientDB = new DynamoDB.DocumentClient()
const clientSns = new SNS()

const orderRepository = new OrderRepository(clientDB, ORDERS_DDB)
const productRepository = new ProductRepository(clientDB,PRODUCTS_DDB)

export async function handler(event:APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> { 

    const lambdaRequestId = context.awsRequestId
    const apiRequestId = event.requestContext.requestId
    const httpMethod = event.httpMethod

    console.log(`Request Id: ${apiRequestId} and Lambda Id: ${lambdaRequestId} and Resource: ${event.resource}`)



    if(httpMethod === 'GET'){

        console.log(`GET - /orders`)

        if(event.queryStringParameters){

            const email = event.queryStringParameters!.email

            const orderId = event.queryStringParameters!.orderId

            if(email && orderId){

                console.log(`GET - order by email and orderID`)

                try {
                    const orders = await orderRepository.getAllOrdersByEmailAndOrderId(email, orderId)

                    return{
                        statusCode:200,
                        body: JSON.stringify(convertToOrderResponse(orders))
                    }           

                } catch (error) {

                    console.log((<Error>error).message)

                    return{
                        statusCode:404,
                        body: (<Error>error).message
                    }  
                    
                }

            }else if(email){

                console.log(`GET - all orders by email`)

                const orders = await orderRepository.getAllOrdersByEmail(email)

                return{
                    statusCode:200,
                    body: JSON.stringify(orders.map(convertToOrderResponse))
                }
            
            }
        }else {

            console.log(`GET - all orders`)
            
            const orders = await orderRepository.getAllOrders()

            return{
                statusCode:200,
                body: JSON.stringify(orders.map(convertToOrderResponse))
            }

        }
    }else if(httpMethod === 'POST'){

        console.log(`POST - /orders`)

        const orderRequest = JSON.parse(event.body!) as OrderRequest

        const products = await productRepository.getProductsByIds(orderRequest.productsId)

        if(products.length === orderRequest.productsId.length){

            const order = buildOrder(orderRequest, products)

            const orderCreatedPromise =  orderRepository.createOrder(order)

            const eventResultPromise = sendOrderTopic(order, OrderEventType.CREATED, lambdaRequestId)

            const resultPromises = await Promise.all([orderCreatedPromise,eventResultPromise])

            console.log(
                `Order created: ${order.sk}
                - MessageId: ${resultPromises[1].MessageId}`
            )

            return {
                statusCode:201,
                body: JSON.stringify(convertToOrderResponse(order))
            }
        } else {

            return {
                statusCode: 404,
                body: "alguns produtos não foram encontrados"
            }
        }


    }else if(httpMethod === 'DELETE'){

        console.log(`DELETE - /orders`)

        const email = event.queryStringParameters!.email

        const orderId = event.queryStringParameters!.orderId

        try {

            const orderDeleted = await orderRepository.deleteOrders(email!, orderId!)

            const eventResult = await sendOrderTopic(orderDeleted, OrderEventType.DELETE, lambdaRequestId)

            console.log(
                `Order deleted: ${orderDeleted.sk}
                - MessageId: ${eventResult.MessageId}`
            )


            return {
                statusCode:201,
                body: JSON.stringify(convertToOrderResponse(orderDeleted))
            }
            
        } catch (error) {
            console.log((<Error>error).message)

            return{
                statusCode:404,
                body: (<Error>error).message
            }             
        }  
    }
    return {
        statusCode: 400,
        body: JSON.stringify({
            message: "Bad request"
        })
    }
}

function sendOrderTopic(order: Order, eventType: OrderEventType, lambdaRequestId: string){

    const productCodes: string [] = []

    order.products.forEach((prod)=>{
        productCodes.push(prod.code)
    })

    const orderEvent: OrderEvent = {
        productCodes: productCodes,
        email: order.pk,
        orderId: order.sk!,
        billing: order.billing,
        shipping: order.shipping,
        requestId: lambdaRequestId
    }

    const envelop: Envelope = {
        eventType: eventType,
        data: JSON.stringify(orderEvent) 
    }

    return clientSns.publish({
        TopicArn: ORDER_EVENTS_TOPIC_ARN,
        Message: JSON.stringify(envelop),
        MessageAttributes: {
            eventType: {
                DataType: "String",
                StringValue: eventType
            }
        } 
    }).promise()
}

function buildOrder(orderRequest: OrderRequest, products: Product[]): Order{

    const orderProductResponse: OrderProductResponse[] = []

    let totalPrice = 0;

    products.forEach((prod) => {
        
        totalPrice+=prod.price

        orderProductResponse.push({
            code: prod.code,
            price: prod.price
        })
    })

    const order: Order = {
        pk: orderRequest.email,
        sk: uuid(),
        createdAt: Date.now(),
        billing: {
            payment: orderRequest.payment,
            totalPrice: totalPrice
        },
        shipping: {
            type: orderRequest.shipping.type,
            carrier: orderRequest.shipping.carrier
        },
        products: orderProductResponse
    }

return order
}

function convertToOrderResponse(order: Order): OrderResponse {

    const orderProducts: OrderProductResponse[]=[]
    
    order.products.forEach((p)=>{
        orderProducts.push({
            code: p.code,
            price: p.price
        })
    })

    const orderResponse: OrderResponse = {
        email: order.pk,
        id: order.sk!,
        createdAt: order.createdAt!,
        products: orderProducts,
        billing: {
            payment: order.billing.payment as PaymentType,
            totalPrice: order.billing.totalPrice
        },
        shipping: {
            type: order.shipping.type as ShippingType,
            carrier: order.shipping.carrier as CarrierType
        }

    }

    return orderResponse
}
