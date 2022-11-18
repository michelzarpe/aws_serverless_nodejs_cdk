import { APIGatewayEventDefaultAuthorizerContext } from "aws-lambda";
import { CognitoIdentityServiceProvider } from "aws-sdk";

export class AuthInfoService {
    private cognitoIdentityServiceProvider: CognitoIdentityServiceProvider


    constructor(ognitoIdentityServiceProvider: CognitoIdentityServiceProvider){
        this.cognitoIdentityServiceProvider = ognitoIdentityServiceProvider
    }

    async getUserInfo(authorizer: APIGatewayEventDefaultAuthorizerContext): Promise<String> {
        const userPoolId = authorizer?.claims.iss.split("amazonaws.com/")[1]
        const userName = authorizer?.claims.username

        const user = await this.cognitoIdentityServiceProvider.adminGetUser({
            UserPoolId: userPoolId,
            Username: userName
        }).promise()
        
        const email = user.UserAttributes?.find(atribute => atribute.Name === 'email')
        if(email?.Value){
            return email.Value
        }else {
            throw new Error("Email not Found")
        }
    }

}