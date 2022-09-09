import { Context, SQSEvent } from "aws-lambda"
import * as AWSXray from "aws-xray-sdk"

AWSXray.captureAWS(require("aws-sdk"))

export async function handler(event: SQSEvent, context: Context): Promise<void> {
    event.Records.forEach((rec)=>{
        console.log(rec)
        const body = JSON.parse(rec.body)
        console.log(body)
    })
}