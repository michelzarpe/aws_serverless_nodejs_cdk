import { Context, SNSMessage, SQSEvent } from "aws-lambda"
import { SES } from "aws-sdk"
import * as AWSXray from "aws-xray-sdk"
import { Envelope, OrderEvent } from "/opt/nodejs/orderEventsLayer"

AWSXray.captureAWS(require("aws-sdk"))
const clientSES = new SES()


export async function handler(event: SQSEvent, context: Context): Promise<void> {
   
    event.Records.forEach((rec)=>{
        console.log(rec)
        const body = JSON.parse(rec.body) as SNSMessage
        console.log(body)
        // no curso o retorno era assincrono, aula 157
        sendOrderEmail(body)
    })

    return 
}

function sendOrderEmail(body: SNSMessage) {

    const envelope = JSON.parse(body.Message) as Envelope

    const event = JSON.parse(envelope.data) as OrderEvent

   return clientSES.sendEmail({
    Destination:{
        ToAddresses: [event.email]
    },
    Message: {
        Body: {
            Text: {
                Charset: "UTF-8",
                Data: `Recebemos seu pedido de numero ${event.orderId}`
            }
        },
        Subject: {
            Charset: "UTF-8",
            Data: "Pedido recebido"
        }
    },
    Source: "colocar um dos emails que foi criado a edentidade na AWS dentro de SES",
    ReplyToAddresses:['colocar um dos emails que foi criado a edentidade na AWS dentro de SES']
   })
}