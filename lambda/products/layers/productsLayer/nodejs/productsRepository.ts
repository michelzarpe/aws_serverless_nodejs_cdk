import {DocumentClient} from "aws-sdk/clients/dynamodb"
import {v4 as uuid} from "uuid"


export interface Product {
    id: string;
    productName: string; 
    code: string;
    price: number; 
    model: string;
}


export class ProductRepository {

    private ddbClient: DocumentClient
    private productsDdb: string

    constructor(ddbClient: DocumentClient, productsDdb: string){
        this.ddbClient = ddbClient
        this.productsDdb = productsDdb
    }


    async getAllProducts(): Promise<Product[]>{
        const data = await this.ddbClient.scan({
            TableName: this.productsDdb
        }).promise()

        return data.Items as Product[]
    }

    async getProductById(productId: string): Promise<Product>{
        const data = await this.ddbClient.get({
            TableName: this.productsDdb,
            Key: {
                id: productId
            }
        }).promise();

        if(data.Item){
            return data.Item as Product
        }
        throw new Error('Produto não encontrado')
    }

    async create(product: Product) {
        product.id = uuid()
        await this.ddbClient.put({
            TableName: this.productsDdb,
            Item: product
        }).promise()
        return product
    }


    async deleteProductById(productId: string): Promise<Product>{
        const data = await this.ddbClient.delete({
            TableName: this.productsDdb,
            Key: {
                id: productId
            },
            ReturnValues: "ALL_OLD"
        }).promise()

        if(data.Attributes){
            return data.Attributes as Product
        }
        throw new Error('Produto não encontrado')
    }

}