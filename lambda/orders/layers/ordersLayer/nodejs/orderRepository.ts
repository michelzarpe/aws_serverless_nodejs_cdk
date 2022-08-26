import {DocumentClient} from "aws-sdk/clients/dynamodb"
import {v4 as uuid} from "uuid"

export interface OrderProduct {
    code: string,
    price: number
}

export interface Order {
    pk: string,
    sk?: string,
    createdAt?: number,
    shipping: {
        type: "URGENT" | "ECONOMIC",
        carrier: "CORREIOS" | "FEDEX"
    },
    billing: {
        payment: "CASH" | "DEBIT_CARD" | "CREDIT_CARD",
        totalPrice: number
    },

    products: OrderProduct []
}


export class OrderRepository {
    private ddbClient: DocumentClient
    private orderDdb: string

    constructor(ddbClient: DocumentClient, orderDdb: string){
        this.ddbClient = ddbClient
        this.orderDdb = orderDdb
    }

    async createOrder(order: Order): Promise<Order> {

        order.sk = uuid();
        order.createdAt= Date.now();
         await this.ddbClient.put({
            TableName: this.orderDdb,
            Item: order
        }).promise()
        
        return order
    }

    async getAllOrders(): Promise<Order[]> {
 
        const data = await this.ddbClient.scan({
            TableName: this.orderDdb
        }).promise()
 
        return data.Items as Order[]
    }

    async getAllOrdersByEmail(email:  string): Promise<Order[]> {
 
        const data = this.ddbClient.query({
            TableName:this.orderDdb,
            KeyConditionExpression: "pk = :email",
            ExpressionAttributeValues: {
                ":email": email
            }
        }).promise()
 
        return (await data).Items as Order[]
    }
 
    async getAllOrdersByEmailAndOrderId(email:  string, orderId: string): Promise<Order> {
        
        const data = await this.ddbClient.get({
            TableName: this.orderDdb,
            Key: {
                pk: email,
                sk: orderId
            }
        }).promise();

        if(data.Item){
            return data.Item as Order
        }

        throw new Error('Ordem não encontrado')
    }

    async deleteOrders(email:  string, orderId: string): Promise<Order> {

        const data = await this.ddbClient.delete({
            TableName: this.orderDdb,
            Key: {
                pk: email,
                sk: orderId
            },
            ReturnValues: "ALL_OLD"
        }).promise()

        if(data.Attributes){
            return data.Attributes as Order
        }

        throw new Error('Ordem não encontrado')
    }
}