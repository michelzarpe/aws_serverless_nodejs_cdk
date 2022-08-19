import * as cdk from "aws-cdk-lib"
import { Construct } from 'constructs'
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as ssm from "aws-cdk-lib/aws-ssm"


export class ProductsAppLayersStack extends cdk.Stack {
    readonly productsLayers: lambda.LayerVersion


    constructor(scope: Construct, id: string, props: cdk.StackProps){
        super(scope, id, props)
    
        //criando layer para conectar ao banco dynamo
        this.productsLayers = new lambda.LayerVersion(this, "ProductsLayer", {
            code: lambda.Code.fromAsset('lambda/products/layers/productsLayer'),
            compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
            layerVersionName: "ProductsLayer",
            removalPolicy: cdk.RemovalPolicy.RETAIN //mantei mesmo que apague a stack
        })
    
        // colocando arn no systems manager
        new ssm.StringParameter(this, "ProductsLayerVersionArn",{
            parameterName: "ProductsLayerVersionArn",
            stringValue: this.productsLayers.layerVersionArn
        })
    }
}