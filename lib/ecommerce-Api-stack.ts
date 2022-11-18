import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cwlogs from "aws-cdk-lib/aws-logs"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as iam from "aws-cdk-lib/aws-iam"
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
   private productsAdminAuthorizer: apigateway.CognitoUserPoolsAuthorizer
   private ordersAuthorizer: apigateway.CognitoUserPoolsAuthorizer
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

            const adminUserPolicyStatement = new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["cognito-idp:AdminGetUser"],
                resources: [this.adminUserPool.userPoolArn]
            })

            const adminUserPolicy = new iam.Policy(this, 'AdminGetUserPolicy', {
                statements: [adminUserPolicyStatement]
            })
        
            adminUserPolicy.attachToRole(<iam.Role> props.productsAdminHandler.role)

            //integração entre lambdas e gateway na parte de produtos
            this.createProductsService(props, api)  
            this.createOrdersService(props,api)   

        }

    private createCognitoAuth(){

        //trigers
        const postConfirmationHandler = new lambdaNodeJs.NodejsFunction(this, 
            "PostConfirmationFunction",{
            functionName:"PostConfirmationHandler",
            entry: "lambda/auth/postConfirmationFunction.ts",
            handler: "handler",
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false      
            },
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
        })

        const preAuthenticationHandler = new lambdaNodeJs.NodejsFunction(this, 
            "PreAuthenticationFunction",{
                functionName:"PreAuthenticationFunction",
                entry: "lambda/auth/preAuthenticationFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(2),
                bundling: {
                   minify: true,
                   sourceMap: false      
                },
        tracing: lambda.Tracing.ACTIVE,
        insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
    })
    

        // cognito customer UserPool
        this.customerUserPool = new cognito.UserPool(this, "CustomerPool", {
            lambdaTriggers: {
                preAuthentication: preAuthenticationHandler,
                postConfirmation: postConfirmationHandler
            },
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


    // cognito customer UserPool
    this.adminUserPool = new cognito.UserPool(this, "AdminPool", {
        lambdaTriggers: {
            preAuthentication: preAuthenticationHandler,
            postConfirmation: postConfirmationHandler
        },
        userPoolName: "AdminPool",
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        selfSignUpEnabled: false,
        userInvitation: {
            emailSubject: "welcome to ecomerce administrator service",
            emailBody: 'your user is {username} and temporary password is{####}'
        },
        signInAliases: {
            username: false,
            email: true
        },
        standardAttributes: {
            email: {
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

    this.adminUserPool.addDomain("AdminDomain", {
        cognitoDomain: {
            domainPrefix: "mez2022-admin-service"
        }
    })

        this.customerUserPool.addDomain("CustomerDomain", {
            cognitoDomain: {
                domainPrefix: "mez2022-customer-service"
            }
        })

        const adminWebScope = new cognito.ResourceServerScope({
            scopeName: "web",
            scopeDescription: "Admin web operation"
        })

        const customerWebScope = new cognito.ResourceServerScope({
            scopeName: "web",
            scopeDescription: "Customer web operation"
        })

        const customerMobileScope = new cognito.ResourceServerScope({
            scopeName: "mobile",
            scopeDescription: "Customer mobile operation"
        })

        const adminResourceServer = this.adminUserPool.addResourceServer("AdminResourceServer", {
            identifier: "admin",
            userPoolResourceServerName: "AdminResourceServer",
            scopes: [adminWebScope]
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

        this.adminUserPool.addClient("admin-web-client", {
            userPoolClientName: "adminWebClient",
            authFlows: {
                userPassword: true
            },
            accessTokenValidity: cdk.Duration.minutes(60),
            refreshTokenValidity: cdk.Duration.days(7),
            oAuth: {
                scopes: [cognito.OAuthScope.resourceServer(adminResourceServer, adminWebScope)]
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

        this.productsAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "ProductsAuthorizer", {
            authorizerName: "ProductsAuthorizer",
            cognitoUserPools: [this.customerUserPool, this.adminUserPool]
        })

        this.productsAdminAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "ProductsAdminAuthorizer", {
            authorizerName: "ProductsAdminAuthorizer",
            cognitoUserPools: [this.adminUserPool]
        })

        this.ordersAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "OrdersAuthorizer", {
            authorizerName: "OrdersAuthorizer",
            cognitoUserPools: [this.customerUserPool, this.adminUserPool]
        })
    }   

    private createOrdersService(props: EcommerceApiStackProps, api: apigateway.RestApi) {

        const ordersIntegration = new apigateway.LambdaIntegration(props.ordersHandler)// fazer integração entre gateway e function

        const ordersResourse = api.root.addResource("orders")

        // GET /orders
        // GET /orders?email=...
        // GET /orders?email=...&orderId=...
        ordersResourse.addMethod("GET", ordersIntegration, {
            authorizer: this.ordersAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ["customer/web", "customer/mobile", "admin/web"]
        })

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
            requestValidator: orderDletionValidation,
            authorizer: this.ordersAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ["customer/web", "admin/web"]
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
            },
            authorizer: this.ordersAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ["customer/web", "admin/web"]
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

        const productsFetchWebMobileIntegrationOption = {
            authorizer: this.productsAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['customer/web','customer/mobile', 'admin/web']
        }


        const productsFetchWebIntegrationOption = {
            authorizer: this.productsAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['customer/web', 'admin/web']
        }

        // GET /products
        const productsResourse = api.root.addResource("products")
        productsResourse.addMethod("GET", productsFetchIntegration, productsFetchWebMobileIntegrationOption)

        // GET /products/{id}
        const productsResourceId = productsResourse.addResource("{id}")
        productsResourceId.addMethod("GET", productsFetchIntegration, productsFetchWebIntegrationOption)

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
            },
            authorizer: this.productsAdminAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['admin/web']
        })
        // PUT /products/{id}
        productsResourceId.addMethod("PUT", productsAdminIntegration, {
            authorizer: this.productsAdminAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['admin/web']
        })
        // DELETE /products/{id}
        productsResourceId.addMethod("DELETE", productsAdminIntegration, {
            ,
            authorizer: this.productsAdminAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            authorizationScopes: ['admin/web']
        })
    }
}