import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

export async function handler(event:APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {    

    const lambdaRequestId = context.awsRequestId
    const apiRequestId = event.requestContext.requestId
    const httpMethod = event.httpMethod


    console.log(`Request Id: ${apiRequestId} and Lambda Id: ${lambdaRequestId} and Resource: ${event.resource}`)

    if(event.resource === "/products"){
        if( httpMethod === 'GET'){
            console.log("GET - /products")
            return {
                statusCode: 200, 
                body: JSON.stringify({
                    message: "GET Products - OK"
                })
            }
        }
    } else if(event.resource === "/products/{id}"){
        const productId = event.pathParameters!.id as string
        console.log(`GET - /products/{${productId}}`)
        return {
            statusCode: 200, 
            body: JSON.stringify({
                message: `GET - /products/{${productId}}`
            })
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify({
            message: "Bad request"
        })
    }
}