import { DocumentClient } from "aws-sdk/clients/dynamodb";

export enum InvoiceTransactionStatus {
    GENERATED = "URL_GENERATED",
    RECEIVED = "INVOICE_RECEIVED",
    PROCESSD = "INVOICE_PROCESSED",
    TIMEOUT = "TIMEOUT",
    CANCELLED = "INVOICE_CANCELLED",
    NON_VALID_INVOICE_NUMBER = "NON_VALID_INVOICE_NUMBER"
}

export interface InvoiceTransaction {
    pk: string;
    sk: string;
    ttl: number;
    requestId: string;
    timestamp: number;
    expiresIn: number;
    connectionId: string;
    endpoint: string;
    transactionStatus: InvoiceTransactionStatus
}


export class InvoiceTransactionRepository {
    private ddbClient: DocumentClient
    private invoiceTransactionddb: string

    constructor(ddbClient: DocumentClient,invoiceTransactionddb: string){
        this.ddbClient = ddbClient
        this.invoiceTransactionddb = invoiceTransactionddb
    }

    async createInvoiceTransaction(invoiceTransaction:InvoiceTransaction): Promise<InvoiceTransaction {
        await this.ddbClient.put({
            TableName: this.invoiceTransactionddb,
            Item: invoiceTransaction
        }).promise()

        return invoiceTransaction
    }


   async getInvoiceTransaction(key: string): Promise<InvoiceTransaction> {
    const data = await this.ddbClient.get({
        TableName: this.invoiceTransactionddb,
        Key: {
            pk: "#transaction",
            sk: key
        }
    }).promise()

    if(data.Item){
        return data.Item as InvoiceTransaction
    } else {
        throw new Error("invoice transaction not found")
    }
   }

   async updateInvoiceTransaction(key: string, status: InvoiceTransactionStatus): Promise<boolean> {
    try {
        await this.ddbClient.update({
            TableName: this.invoiceTransactionddb,
            Key: {
                pk: "#transaction",
                sk: key
            },
            ConditionExpression: 'attribute_exists(pk)',
            UpdateExpression: 'set transactionStatus = :s',
            ExpressionAttributeValues: {
                ':s' :status
            }
        }).promise()

        return true
    } catch (ConditionalCheckFailedException) {
        console.error("invoice transaction not found")
        return false
    } 
   }
}