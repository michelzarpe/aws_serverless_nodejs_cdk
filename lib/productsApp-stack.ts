import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import { Construct } from 'constructs'
import * as dynadb from 'aws-cdk-lib/aws-dynamodb'


export class ProductsAppStack extends cdk.Stack {

readonly productsFetchHandler: lambdaNodeJs.NodejsFunction
readonly productsAdminHandler: lambdaNodeJs.NodejsFunction

readonly productsDdb: dynadb.Table


    constructor(scope: Construct, id: string, props?: cdk.StackProps){
        super(scope,id,props)

        // constuindo tabela no dynamo
        this.productsDdb = new dynadb.Table(this, "ProductsDdb", {
            tableName: "products",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: "id",
                type: dynadb.AttributeType.STRING
            },
            billingMode: dynadb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })

        //construindo função Fetch
        this.productsFetchHandler = new lambdaNodeJs.NodejsFunction(this, 
            "ProductsFetchFunction",{
                functionName:"ProductsFetchFunction",
                entry: "lambda/products/productsFetchFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(5),
                bundling: {
                   minify: true,
                   sourceMap: false      
                },
                environment: {
                    PRODUCTS_DDB: this.productsDdb.tableName
                }
            })


         //construindo função Fetch
        this.productsAdminHandler = new lambdaNodeJs.NodejsFunction(this, 
            "ProductsAdminFunction",{
                functionName:"ProductsAdminFunction",
                entry: "lambda/products/productsAdminFunction.ts",
                handler: "handler",
                memorySize: 128,
                timeout: cdk.Duration.seconds(5),
                bundling: {
                   minify: true,
                   sourceMap: false      
                },
                environment: {
                    PRODUCTS_DDB: this.productsDdb.tableName
                }
            })

        //inserindo permissão de leitura 
        this.productsDdb.grantReadData(this.productsFetchHandler)
        this.productsDdb.grantWriteData(this.productsAdminHandler)
        
    }
}