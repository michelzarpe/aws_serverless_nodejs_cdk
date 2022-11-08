import { ApiGatewayManagementApi } from "aws-sdk";

export class InvoiceWSService {
    private apiGwManagementApi: ApiGatewayManagementApi

    constructor(apiGwManagementApi: ApiGatewayManagementApi){
        this.apiGwManagementApi = apiGwManagementApi
    }

    sendInvoiceStatus(transactionId: string, connectionId: string, status: string){

        const postData = JSON.stringify({
            transactionId: transactionId,
            status: status
        })

        return this.sendData(connectionId, postData)
    }

    async sendData(connectionId: string, data: string): Promise<boolean> {
        
        
        try {
         
            await this.apiGwManagementApi.getConnection({
                ConnectionId: connectionId
            }).promise()
            
            await this.apiGwManagementApi.postToConnection({
                ConnectionId:connectionId,
                Data: data
            })
            
            return true            
        } catch (error) {
            return false
        }
    }

    async disconnectClient(connectionId: string): Promise<boolean>{
        try{
            await this.apiGwManagementApi.getConnection({
                ConnectionId: connectionId
            }).promise()

            await this.apiGwManagementApi.deleteConnection({
                ConnectionId: connectionId
            }).promise()

            return true
        }catch(err){
            console.log(err);
            return false
            
        }
    }
}