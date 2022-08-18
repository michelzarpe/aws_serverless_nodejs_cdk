import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack'; 
import { ECommerceApiStack } from '../lib/ecommerce-Api-stack';

const app = new cdk.App();

const env: cdk.Environment = {
    account: "631842816311",
    region: "us-east-1"
}

const tags = {
    cost: "Ecommerce",
    team: "Mz"
}

const productsAppStack = new ProductsAppStack(app,"ProductsApp", {
    tags: tags,
    env: env
})

const eCommerceApiStack = new ECommerceApiStack(app,"ECommerceApiGateway", {
    productsFetchHandler: productsAppStack.productsFetchHandler,
    productsAdminHandler: productsAppStack.productsAdminHandler,
    tags: tags,
    env: env
})

eCommerceApiStack.addDependency(productsAppStack)