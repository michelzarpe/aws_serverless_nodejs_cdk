import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer"
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

        const productDto = JSON.parse(event.body!) as Product

        console.log(`POST - /products {${productDto}}`)

        const productCreated = await productRepository.create(productDto)

        return {
            statusCode: 200, 
            body: JSON.stringify({
                data: productCreated,
                message: "POST Products - OK"
            })
        }
    }else if(event.resource === "/products/{id}"){
        
        const productId = event.pathParameters!.id as string

        if(event.httpMethod === 'PUT'){

            console.log(`PUT - /products/{${productId}}`)
            
            try {
            
                const productDTO = JSON.parse(event.body!) as Product

                const productUpdated = await productRepository.updateProductById(productId,productDTO)
            
                return {
                    statusCode: 200, 
                    body: JSON.stringify({
                        data: productUpdated,
                        message: `PUT - /products/{${productId}}`
                    })
                }
            } catch (error) {
            
                console.log(`ERROR -> UPDATED - /products/{${productId}}`)
            
                return {
                    statusCode: 404, 
                    body: JSON.stringify({
                        message: `ERROR -> UPDATED - /products/{${productId}}`
                    })
                }
            }


        }else if (event.httpMethod === 'DELETE'){
            
            console.log(`DELETE - /products/{${productId}}`)
            
            try {
            
                const productDeleted = await productRepository.deleteProductById(productId)
            
                return {
                    statusCode: 200, 
                    body: JSON.stringify({
                        data: productDeleted,
                        message: `DELETE - /products/{${productId}}`
                    })
                }
            } catch (error) {
            
                console.log((<Error> error).message)
            
                return {
                    statusCode: 404, 
                    body: JSON.stringify({
                        message: `ERROR -> DELETE - /products/{${productId}}`
                    })
                }
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