import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda"
import { ProductRepository } from "/opt/nodejs/productsLayer"
import { DynamoDB } from "aws-sdk"
import * as AWSXray from "aws-xray-sdk"

AWSXray.captureAWS(require("aws-sdk"))

const productDB = process.env.PRODUCTS_DDB!
const clientDB = new DynamoDB.DocumentClient()
const productRepository = new ProductRepository(clientDB,productDB)


export async function handler(event:APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {    

    const lambdaRequestId = context.awsRequestId
    const apiRequestId = event.requestContext.requestId
    const httpMethod = event.httpMethod


    console.log(`Request Id: ${apiRequestId} and Lambda Id: ${lambdaRequestId} and Resource: ${event.resource}`)

    if(event.resource === "/products"){
        if( httpMethod === 'GET'){
            
            const data = await productRepository.getAllProducts()

            console.log(`GET - /products ${data}`)

            return {
                statusCode: 200, 
                body: JSON.stringify({
                    data: data,
                    message: "GET Products - OK"
                })
            }
        }
    } else if(event.resource === "/products/{id}"){

        const productId = event.pathParameters!.id as string

        try{
            const data = await productRepository.getProductById(productId)

            console.log(`GET - /products/{${productId}}, data: {${data}}`)
            
            return {
                statusCode: 200, 
                body: JSON.stringify({
                    data: data,
                    message: `GET - /products/{${productId}}`
                })
            }
        } catch (error){

            console.error((<Error>error).message)
            
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: (<Error>error).message
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