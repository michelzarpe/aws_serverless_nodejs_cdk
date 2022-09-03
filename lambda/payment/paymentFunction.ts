import { Context, SNSEvent } from "aws-lambda"
import * as AWSXray from "aws-xray-sdk"

AWSXray.captureAWS(require("aws-sdk"))

export async function handler(event: SNSEvent, context: Context): Promise<void> {
    event.Records.forEach((rec)=> {
        console.log(rec.Sns)
    })
return
}