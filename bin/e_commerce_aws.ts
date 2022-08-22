import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack'; 
import { ECommerceApiStack } from '../lib/ecommerce-Api-stack';
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stact';

const app = new cdk.App();

const env: cdk.Environment = {
    account: "631842816311",
    region: "us-east-1"
}

const tags = {
    cost: "Ecommerce",
    team: "Mz"
}


 const productsLayer = new ProductsAppLayersStack(app,"ProductsLayer",{
     tags: tags,
     env: env
 })

const productsAppStack = new ProductsAppStack(app,"ProductsApp", {
    tags: tags,
    env: env
})
productsAppStack.addDependency(productsLayer)

const eCommerceApiStack = new ECommerceApiStack(app,"ECommerceApiGateway", {
    productsFetchHandler: productsAppStack.productsFetchHandler,
    productsAdminHandler: productsAppStack.productsAdminHandler,
    tags: tags,
    env: env
})

eCommerceApiStack.addDependency(productsAppStack)