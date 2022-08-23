import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from "aws-cdk-lib/aws-ssm"
import { Construct } from 'constructs'



interface OrdersAppStackProps extends cdk.StackProps {
    productsDdb: dynamodb.Table
}



export class OrdersAppStack extends cdk.Stack {

    readonly ordersDdb: dynamodb.Table
    readonly ordersHandler: lambdaNodeJs.NodejsFunction

    constructor(scope: Construct, id: string, props: OrdersAppStackProps){
        super(scope,id,props)

        // constuindo tabela no dynamo
        this.ordersDdb = new dynamodb.Table(this, "OrdersDdb", {
            tableName: "orders",
            removalPolicy: cdk.RemovalPolicy.DESTROY,

            partitionKey: {
                name: "pk",
                type: dynamodb.AttributeType.STRING
            },
            sortKey:{
                name: "sk",
                type: dynamodb.AttributeType.STRING
            },


            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })

        //orders layer
        const ordersLayersArn = ssm.StringParameter.valueForStringParameter(this, "OrdersLayerVersionArn")
        const ordersLayer = lambda.LayerVersion.fromLayerVersionArn(this, "OrdersLayerVersionArn",ordersLayersArn)

        //products layer
        const productsLayersArn = ssm.StringParameter.valueForStringParameter(this, "ProductsLayerVersionArn")
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, "ProductsLayerVersionArn",productsLayersArn)


    }
}