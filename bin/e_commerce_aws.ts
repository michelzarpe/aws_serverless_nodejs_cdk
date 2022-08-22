import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack'; 
import { ECommerceApiStack } from '../lib/ecommerce-Api-stack';
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stact';
import { EventsDbdStack } from '../lib/eventsddb-stack';

const app = new cdk.App();

const env: cdk.Environment = {
    account: "631842816311",
    region: "us-east-1"
}

const tags = {
    cost: "Ecommerce",
    team: "Mz"
}

const productsLayerStack = new ProductsAppLayersStack(app,"ProductsLayer",{
     tags: tags,
     env: env
 })

const eventsDbdStack = new EventsDbdStack(app, "EventsDdb",{
    tags: tags,
    env: env
})

const productsAppStack = new ProductsAppStack(app,"ProductsApp", {
    eventsDdb: eventsDbdStack.table, 
    tags: tags,
    env: env
})
productsAppStack.addDependency(productsLayerStack)
productsAppStack.addDependency(eventsDbdStack)

const eCommerceApiStack = new ECommerceApiStack(app,"ECommerceApiGateway", {
    productsFetchHandler: productsAppStack.productsFetchHandler,
    productsAdminHandler: productsAppStack.productsAdminHandler,
    tags: tags,
    env: env
})

eCommerceApiStack.addDependency(productsAppStack)