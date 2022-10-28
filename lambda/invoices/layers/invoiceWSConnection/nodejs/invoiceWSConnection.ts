import { ApiGatewayManagementApi } from "aws-sdk";

export class InvoiceWSService {
    private apiGwManagementApi: ApiGatewayManagementApi

    constructor(apiGwManagementApi: ApiGatewayManagementApi){
        this.apiGwManagementApi = apiGwManagementApi
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
}