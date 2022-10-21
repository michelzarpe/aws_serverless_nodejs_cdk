import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda"
import * as AWSXray from "aws-xray-sdk"

AWSXray.captureAWS(require("aws-sdk"))

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    
    console.log(event)

    return {
        statusCode: 200,
        body: 'OK'
    }
}

