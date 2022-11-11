import { APIGatewayProxyEvent, APIGatewayProxyResult, Context, EventBridgeEvent } from "aws-lambda"
import * as AWSXray from "aws-xray-sdk"

AWSXray.captureAWS(require("aws-sdk"))

export async function handler(event: EventBridgeEvent<string, string>, context: Context): Promise<void> {
    
    console.log(event)

}