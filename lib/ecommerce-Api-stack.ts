import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cwlogs from "aws-cdk-lib/aws-logs"
import { Construct } from 'constructs'


interface EcommerceApiStackProps extends cdk.StackProps {
    productsFetchHandler: lambdaNodeJs.NodejsFunction
    productsAdminHandler: lambdaNodeJs.NodejsFunction
}

export class ECommerceApiStack extends cdk.Stack{

    constructor(scope: Construct, id: string, props: EcommerceApiStackProps){
        super(scope,id,props)

            const logGroup = new cwlogs.LogGroup(this, "EComerceApiGatewayLogs")

            const api = new apigateway.RestApi(this, "ECommerceApiGateway", {
                restApiName: "ECommerceApiGateway",
                deployOptions : {
                    accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
                    accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                        httpMethod: true, 
                        ip: true, 
                        protocol: true,
                        requestTime: true,
                        resourcePath: true,
                        responseLength: true,
                        status: true,
                        caller: true,
                        user: true
                    })
                }
            })

            //integração entre lambdas e gateway
            const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler)
            const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)
               
            // GET /products
            const productsResourse = api.root.addResource("products")
            productsResourse.addMethod("GET", productsFetchIntegration) 

            // GET /products/{id}
            const productsResourceId = productsResourse.addResource("{id}")
            productsResourceId.addMethod("GET",productsFetchIntegration)


            // POST /products
            productsResourceId.addMethod("POST",productsAdminIntegration)
            // PUT /products/{id}
            productsResourceId.addMethod("PUT",productsAdminIntegration)
            // DELETE /products/{id}
            productsResourceId.addMethod("DELETE",productsAdminIntegration)
           


        }
}