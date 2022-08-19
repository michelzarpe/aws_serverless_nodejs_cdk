import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { ProductRepository } from "/opt/nodejs/productsLayer"
import { DynamoDB } from "aws-sdk"

const productDB = process.env.PRODUCTS_DDB!
const clientDB = new DynamoDB.DocumentClient()
const productRepository = new ProductRepository(clientDB,productDB)

export async function handler(event:APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {    

    const lambdaRequestId = context.awsRequestId
    const apiRequestId = event.requestContext.requestId
    const httpMethod = event.httpMethod


    console.log(`Request Id: ${apiRequestId} and Lambda Id: ${lambdaRequestId} and Resource: ${event.resource}`)


    if(event.resource === "/products"){
        console.log("POST - /products")
        return {
            statusCode: 200, 
            body: JSON.stringify({
                message: "POST Products - OK"
            })
        }
    }else if(event.resource === "/products/{id}"){
        const productId = event.pathParameters!.id as string

        if(event.httpMethod === 'PUT'){
            console.log(`PUT - /products/{${productId}}`)
            return {
                statusCode: 200, 
                body: JSON.stringify({
                    message: `PUT - /products/{${productId}}`
                })
            }
        }else if (event.httpMethod === 'DELETE'){
            console.log(`DELETE - /products/{${productId}}`)
            return {
                statusCode: 200, 
                body: JSON.stringify({
                    message: `DELETE - /products/{${productId}}`
                })
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