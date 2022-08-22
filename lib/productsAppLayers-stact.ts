import * as cdk from "aws-cdk-lib"
import { Construct } from 'constructs'
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as ssm from "aws-cdk-lib/aws-ssm"


export class ProductsAppLayersStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: cdk.StackProps){
        super(scope, id, props)
    
        //criando layer para conectar a tabela products do banco dynamo
        const productsLayers = new lambda.LayerVersion(this, "ProductsLayer", {
            code: lambda.Code.fromAsset('lambda/products/layers/productsLayer'),
            compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
            layerVersionName: "ProductsLayer",
            removalPolicy: cdk.RemovalPolicy.DESTROY //mantei mesmo que apague a stack
        })
    
        // colocando arn no systems manager
        new ssm.StringParameter(this, "ProductsLayerVersionArn",{
            parameterName: "ProductsLayerVersionArn",
            stringValue: productsLayers.layerVersionArn
        })
        
        //criando layer para conectar ao banco a tabela events do dynamo
        const productEventsLayers = new lambda.LayerVersion(this, "ProductEventsLayer", {
            code: lambda.Code.fromAsset('lambda/products/layers/productEventsLayer'),
            compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
            layerVersionName: "ProductEventsLayer",
            removalPolicy: cdk.RemovalPolicy.DESTROY //destruindo quando apagar a stack
        })
    
        // colocando arn no systems manager
        new ssm.StringParameter(this, "ProductEventsLayerVersionArn",{
            parameterName: "ProductEventsLayerVersionArn",
            stringValue: productEventsLayers.layerVersionArn
        })


    }
}