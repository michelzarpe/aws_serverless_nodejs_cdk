import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cwlogs from "aws-cdk-lib/aws-logs"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { Construct } from 'constructs'
import { AlpnPolicy } from "aws-cdk-lib/aws-elasticloadbalancingv2"


interface EcommerceApiStackProps extends cdk.StackProps {
    productsFetchHandler: lambdaNodeJs.NodejsFunction;
    productsAdminHandler: lambdaNodeJs.NodejsFunction;
    ordersHandler: lambdaNodeJs.NodejsFunction;
    ordersEventsFetchHandler: lambdaNodeJs.NodejsFunction;

}

export class ECommerceApiStack extends cdk.Stack{

   private productsAuthorizer: apigateway.CognitoUserPoolsAuthorizer
   private customerUserPool: cognito.UserPool
   private adminUserPool: cognito.UserPool

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

            this.createCognitoAuth()
        
            //integração entre lambdas e gateway na parte de produtos
            this.createProductsService(props, api)  
            this.createOrdersService(props,api)   

        }

    private createCognitoAuth(){
        // cognito customer UserPool
        this.customerUserPool = new cognito.UserPool(this, "CustomerPool", {
            userPoolName: "CustomerPool",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            selfSignUpEnabled: true,
            autoVerify: {
                email: true,
                phone: false
            },
            userVerification: {
                emailSubject: "Verify your email for the ECommerce service!",
                emailBody: "Thanks for signing up to ecommerce service! Your verification code is {####}",
                emailStyle: cognito.VerificationEmailStyle.CODE
            },
            signInAliases: {
                username: false,
                email: true
            },
            standardAttributes: {
                fullname: {
                    required: true,
                    mutable: false
                }
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
                tempPasswordValidity: cdk.Duration.days(3)
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY
        })


        this.customerUserPool.addDomain("CustomerDomain", {
            cognitoDomain: {
                domainPrefix: "mez2022-customer-service"
            }
        })

        const customerWebScope = new cognito.ResourceServerScope({
            scopeName: "web",
            scopeDescription: "Customer web operation"
        })

        const customerMobileScope = new cognito.ResourceServerScope({
            scopeName: "mobile",
            scopeDescription: "Customer mobile operation"
        })

        const customerResourceServer = this.customerUserPool.addResourceServer("CustomerResourceServer", {
                identifier: "customer",
                userPoolResourceServerName: "CustomerResourceServer",
                scopes: [customerMobileScope, customerWebScope]
        })

        this.customerUserPool.addClient("customer-web-client", {
            userPoolClientName: "customerWebClient",
            authFlows: {
                userPassword: true
            },
            accessTokenValidity: cdk.Duration.minutes(60),
            refreshTokenValidity: cdk.Duration.days(7),
            oAuth: {
                scopes: [cognito.OAuthScope.resourceServer(customerResourceServer,customerWebScope)]
            }
        })

        this.customerUserPool.addClient("customer-mobile-client", {
            userPoolClientName: "customerMobileClient",
            authFlows: {
                userPassword: true
            },
            accessTokenValidity: cdk.Duration.minutes(60),
            refreshTokenValidity: cdk.Duration.days(7),
            oAuth: {
                scopes: [cognito.OAuthScope.resourceServer(customerResourceServer,customerMobileScope)]
            }
        })

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
        // GET /orders/events
        const orderEventsResource = ordersResourse.addResource("events")
        const orderEventsFetchValidator = new apigateway.RequestValidator(this, "OrderEventsFetchValidator", {
            restApi: api, 
            requestValidatorName: "OrderEventsFetchValidator",
            validateRequestParameters: true
        })

        const orderEventsFunctionIntegration = new apigateway.LambdaIntegration(props.ordersEventsFetchHandler)
        // GET /orders/events?email=haha@email.com
        // GET /orders/events?email=haha@email.com&eventyType=ORDER_CREATED
        orderEventsResource.addMethod('GET',orderEventsFunctionIntegration, {
            requestParameters: {
                'method.request.querystring.email': true,
                'method.request.querystring.eventType': false                
            },
            requestValidator: orderEventsFetchValidator
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

        const productRequestValidation = new apigateway.RequestValidator(this, "ProductRequestValidator",{
            restApi: api,
            requestValidatorName: "Product request validator",
            validateRequestBody: true
        })

        const productModel = new apigateway.Model(this,"ProductModel",{
            modelName: "ProductModel",
            restApi: api,
            contentType: "application/json",
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    productName: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    code: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    model: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    productUrl: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    price: {
                        type: apigateway.JsonSchemaType.NUMBER
                    }
                },
                required: ["productName","code"]
            }
        })

        // POST /products
        productsResourse.addMethod("POST", productsAdminIntegration, {
            requestValidator: productRequestValidation,
            requestModels: {
                "application/json": productModel
            }
        })
        // PUT /products/{id}
        productsResourceId.addMethod("PUT", productsAdminIntegration)
        // DELETE /products/{id}
        productsResourceId.addMethod("DELETE", productsAdminIntegration)
    }
}