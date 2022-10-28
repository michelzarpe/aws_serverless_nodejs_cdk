import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda"
import { ApiGatewayManagementApi, DynamoDB, S3 } from "aws-sdk"
import * as AWSXray from "aws-xray-sdk"
import {v4 as uuid} from "uuid"
import {InvoiceTransactionStatus, InvoiceTransactionRepository } from '/opt/nodejs/invoiceTransaction'
import { InvoiceWSService } from "/opt/nodejs/invoiceWSConnection"

AWSXray.captureAWS(require("aws-sdk"))

const invoicesDdb = process.env.INVOICE_DDB!
const bucketName = process.env.BUCKET_NAME!
const invoicesWsApiEndPoint = process.env.INVOICE_WSAPI_ENDPOINT!.substring(6)

const s3Client = new S3()
const dbClient = new DynamoDB.DocumentClient()
const apiGwManagementApi = new ApiGatewayManagementApi({
    endpoint: invoicesWsApiEndPoint
})

const invoiceTransactionRepository = new InvoiceTransactionRepository(dbClient,invoicesDdb)
const invoiceWSService = new InvoiceWSService(apiGwManagementApi)


export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    
    const lambdaRequestId = context.awsRequestId
    const connectionId = event.requestContext.connectionId!

    console.log(`connectionid: ${connectionId}, lambdaRequestID: ${lambdaRequestId}`)

    const key = uuid()

    const signedUrlPut = await s3Client.getSignedUrlPromise('putObject', {
        Bucket: bucketName,
        Key: key,
        Expires: 300
    })

    //create invoice transaction

    const timestamp = Date.now()
    const ttl = ~~(timestamp/1000+60*2)

    await invoiceTransactionRepository.createInvoiceTransaction({
        pk:"#transaction",
        sk: key,
        ttl: ttl,
        requestId: lambdaRequestId,
        transactionStatus: InvoiceTransactionStatus.GENERATED,
        timestamp: timestamp,
        expiresIn: 300,
        connectionId: connectionId,
        endpoint: invoicesWsApiEndPoint
    })

    //send url back to ws connect client
    const postData = JSON.stringify({
        url: signedUrlPut,
        expires: 300,
        transactionId: key
    })

    await invoiceWSService.sendData(connectionId, postData)

    return {
        statusCode: 200,
        body: 'OK'
    }
}

