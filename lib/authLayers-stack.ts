import * as lambdaNodeJs from "aws-cdk-lib/aws-lambda-nodejs"
import * as cdk from "aws-cdk-lib"
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cwlogs from "aws-cdk-lib/aws-logs"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as iam from "aws-cdk-lib/aws-iam"
import * as ssm from "aws-cdk-lib/aws-ssm"
import { Construct } from 'constructs'
import { AlpnPolicy } from "aws-cdk-lib/aws-elasticloadbalancingv2"

export class AuthLayersStack extends cdk.Stack{

    constructor(scope: Construct, id: string, props?: cdk.StackProps){
        super(scope,id,props)

        const authUserInfoLayer = new lambda.LayerVersion(this, "AuthUserInfoLayer", {
            compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
            layerVersionName: "AuthUserInfo",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            code: lambda.Code.fromAsset('lambda/auth/layers/authUserInfo') 
        })

        new ssm.StringParameter(this, "AuthUserInfoLayerVersionArn",{
            parameterName: "AuthUserInfoLayerVersionArn",
            stringValue: authUserInfoLayer.layerVersionArn
        })

    }
}