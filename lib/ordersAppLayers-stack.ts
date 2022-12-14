import * as cdk from "aws-cdk-lib"
import { Construct } from 'constructs'
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as ssm from "aws-cdk-lib/aws-ssm"


export class OrdersAppLayersStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps){
        super(scope, id, props)

        //construindo ordersLayers
        const ordersLayer = new lambda.LayerVersion(this, "OrdersLayer", {
            code: lambda.Code.fromAsset('lambda/orders/layers/ordersLayer'),
            compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
            layerVersionName: "OrdersLayer",
            removalPolicy: cdk.RemovalPolicy.DESTROY //mantei mesmo que apague a stack
        })
    
        // colocando arn no systems manager
        new ssm.StringParameter(this, "OrdersLayerVersionArn",{
            parameterName: "OrdersLayerVersionArn",
            stringValue: ordersLayer.layerVersionArn
        })



        //construindo ordersLayers
        const ordersApiLayer = new lambda.LayerVersion(this, "OrdersApiLayer", {
            code: lambda.Code.fromAsset('lambda/orders/layers/ordersApiLayer'),
            compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
            layerVersionName: "OrdersApiLayer",
            removalPolicy: cdk.RemovalPolicy.DESTROY //mantei mesmo que apague a stack
        })
    
        // colocando arn no systems manager
        new ssm.StringParameter(this, "OrdersApiLayerVersionArn",{
            parameterName: "OrdersApiLayerVersionArn",
            stringValue: ordersApiLayer.layerVersionArn
        })


        //construindo ordersEventsLayer
        const orderEventsLayer = new lambda.LayerVersion(this, "OrderEventsLayer", {
            code: lambda.Code.fromAsset('lambda/orders/layers/orderEventsLayer'),
            compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
            layerVersionName: "OrderEventsLayer",
            removalPolicy: cdk.RemovalPolicy.DESTROY //mantei mesmo que apague a stack
        })
    
        // colocando arn no systems manager
        new ssm.StringParameter(this, "OrderEventsLayerArn",{
            parameterName: "OrderEventsLayerArn",
            stringValue: orderEventsLayer.layerVersionArn
        })

        //construindo ordersEventsLayer
        const orderEventsRepositoryLayer = new lambda.LayerVersion(this, "OrderEventsRepositoryLayer", {
            code: lambda.Code.fromAsset('lambda/orders/layers/orderEventsRepositoryLayer'),
            compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
            layerVersionName: "OrderEventsRepositoryLayer",
            removalPolicy: cdk.RemovalPolicy.DESTROY //mantei mesmo que apague a stack
        })
    
        // colocando arn no systems manager
        new ssm.StringParameter(this, "OrderEventsRepositoryLayerArn",{
            parameterName: "OrderEventsRepositoryLayerArn",
            stringValue: orderEventsRepositoryLayer.layerVersionArn
        })        

    }
}