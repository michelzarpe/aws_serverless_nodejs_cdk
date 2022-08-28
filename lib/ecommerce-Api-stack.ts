import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cwlogs from "aws-cdk-lib/aws-logs"
import { Construct } from 'constructs'


interface EcommerceApiStackProps extends cdk.StackProps {
    productsFetchHandler: lambdaNodeJs.NodejsFunction;
    productsAdminHandler: lambdaNodeJs.NodejsFunction;
    ordersHandler: lambdaNodeJs.NodejsFunction;

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

            //integração entre lambdas e gateway na parte de produtos
            this.createProductsService(props, api)  
            this.createOrdersService(props,api)   

        }

    private createOrdersService(props: EcommerceApiStackProps, api: apigateway.RestApi) {

        const ordersIntegration = new apigateway.LambdaIntegration(props.ordersHandler)// fazer integração entre gateway e function

        const ordersResourse = api.root.addResource("orders")

        // GET /orders
        // GET /orders?email=...
        // GET /orders?email=...&orderId=...
        ordersResourse.addMethod("GET", ordersIntegration)

        //validador
        const orderDletionValidation = new apigateway.RequestValidator(this,"OrderDeletionValidator",{
            restApi: api,
            requestValidatorName: "OrderDeletionValidator",
            validateRequestParameters: true
        })

        // DELETE /orders?email=...&orderId=... 
        ordersResourse.addMethod("DELETE", ordersIntegration,{
            requestParameters: {
                'method.request.querystring.email':true,
                'method.request.querystring.orderId':true
            },
            requestValidator: orderDletionValidation
        })

        // POST /orders
        const orderRequestValidator = new apigateway.RequestValidator(this, "OrderRequestValidator",{
            restApi: api,
            requestValidatorName: "Order request validator",
            validateRequestBody: true
        })

        const orderModel = new apigateway.Model(this,"OrderModel",{
            modelName: "OrderModel",
            restApi: api,
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    email: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    productsId: {
                        type: apigateway.JsonSchemaType.ARRAY,
                        minItems: 1,
                        items: {
                            type: apigateway.JsonSchemaType.STRING
                        }
                    },
                    payment: {
                        type: apigateway.JsonSchemaType.STRING,
                        enum: ["CASH","DEBIT_CARD","CREDIT_CARD"]
                    }
                },
                required: ["emai","productsId","payment"]      
            }
        })
        
        ordersResourse.addMethod("POST", ordersIntegration, {
            requestValidator: orderRequestValidator,
            requestModels: {
                "application/son": orderModel
            }
        })
    }    

    private createProductsService(props: EcommerceApiStackProps, api: apigateway.RestApi) {
        const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler)
        const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)

        // GET /products
        const productsResourse = api.root.addResource("products")
        productsResourse.addMethod("GET", productsFetchIntegration)

        // GET /products/{id}
        const productsResourceId = productsResourse.addResource("{id}")
        productsResourceId.addMethod("GET", productsFetchIntegration)


        // POST /products
        productsResourse.addMethod("POST", productsAdminIntegration)
        // PUT /products/{id}
        productsResourceId.addMethod("PUT", productsAdminIntegration)
        // DELETE /products/{id}
        productsResourceId.addMethod("DELETE", productsAdminIntegration)
    }
}