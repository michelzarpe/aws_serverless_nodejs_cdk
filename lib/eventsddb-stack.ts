import * as cdk from "aws-cdk-lib"
import { Construct } from "constructs"
import * as dynamodb  from "aws-cdk-lib/aws-dynamodb"


export class EventsDbdStack extends cdk.Stack {
    readonly table: dynamodb.Table

    constructor(scope: Construct, id: string, props?: cdk.StackProps){
        super(scope, id, props)


        this.table = new dynamodb.Table(this, "EventsDdb", {
            tableName: "events",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: "pk",
                type: dynamodb.AttributeType.STRING
            },
            sortKey:{
                name: "sk",
                type: dynamodb.AttributeType.STRING
            },
            timeToLiveAttribute: "ttl",
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
            //billingMode: dynamodb.BillingMode.PROVISIONED,
            //readCapacity: 1,
            //writeCapacity: 1
        })

        /* configuarções para o modo provisionado 
        const readScale = this.table.autoScaleReadCapacity({
            maxCapacity: 2,
            minCapacity: 1
        })
        readScale.scaleOnUtilization({
            targetUtilizationPercent: 50,
            scaleInCooldown: cdk.Duration.seconds(60),
            scaleOutCooldown: cdk.Duration.seconds(60)
        })

        const writeScale = this.table.autoScaleWriteCapacity({
            maxCapacity: 4,
            minCapacity: 1
        })

        writeScale.scaleOnUtilization({
            targetUtilizationPercent: 50,
            scaleInCooldown: cdk.Duration.seconds(60),
            scaleOutCooldown: cdk.Duration.seconds(60)
        })
       */
    this.table.addGlobalSecondaryIndex({
        indexName: "emailIndex", 
        partitionKey: {
            name: "email",
            type: dynamodb.AttributeType.STRING
        },
        sortKey: {
            name: "sk",
            type: dynamodb.AttributeType.STRING
        },
        projectionType: dynamodb.ProjectionType.ALL
    })
    
    
    }
}