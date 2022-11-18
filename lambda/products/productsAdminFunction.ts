import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer"
import { CognitoIdentityServiceProvider, DynamoDB, Lambda } from "aws-sdk"
import { ProductEvent, ProductEventType } from "/opt/nodejs/productEventsLayer";
import * as AWSXray from "aws-xray-sdk"
import { AuthInfoService } from "/opt/nodejs/authUserInfo";

AWSXray.captureAWS(require("aws-sdk"))

const productDB = process.env.PRODUCTS_DDB!
const productEventFunctionName = process.env.PRODUCT_EVENTS_FUNCTION_NAME!

const clientDB = new DynamoDB.DocumentClient()
const lambdaClient = new Lambda()
const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider()

const productRepository = new ProductRepository(clientDB,productDB)
const authInfoService = new AuthInfoService(cognitoIdentityServiceProvider)

export async function handler(event:APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {    

    const lambdaRequestId = context.awsRequestId
    const apiRequestId = event.requestContext.requestId
    const httpMethod = event.httpMethod


    console.log(`Request Id: ${apiRequestId} and Lambda Id: ${lambdaRequestId} and Resource: ${event.resource}`)

    const userEmail = await (await authInfoService.getUserInfo(event.requestContext.authorizer)).toString() 

    if(event.resource === "/products"){

        const productDto = JSON.parse(event.body!) as Product

        console.log(`POST - /products {${productDto}}`)

        const productCreated = await productRepository.create(productDto)

        const response = await sendProductEvent(productCreated, ProductEventType.CREATED, userEmail, lambdaRequestId)

        console.log(`Response do eventProduct ${response}`)

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

                const response = await sendProductEvent(productUpdated, ProductEventType.UPDATED, userEmail, lambdaRequestId)

                console.log(`Response do eventProduct ${response}`)
            
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

                const response = await sendProductEvent(productDeleted, ProductEventType.DELETED, userEmail, lambdaRequestId)

                console.log(`Response do eventProduct ${response}`)
            
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

function sendProductEvent(product: Product, eventType: ProductEventType, email: string, lambdaRequestId: string) {
    
    const event: ProductEvent = {
        email: email, 
        eventType: eventType,
        productCode: product.code,
        productId: product.id,
        productPrice: product.price,
        requestId: lambdaRequestId
    }

    return lambdaClient.invoke({
        FunctionName: productEventFunctionName,
        Payload: JSON.stringify(event),
        //InvocationType: "RequestResponse" //querendo dizer que é de forma sincrona
        InvocationType: "Event" //querendo dizer que a execução será de forma assincrona
    }).promise()

}