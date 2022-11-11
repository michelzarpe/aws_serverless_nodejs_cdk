import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack'; 
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stact';
import { EventsDbdStack } from '../lib/eventsddb-stack';
import { OrdersAppLayersStack } from '../lib/ordersAppLayers-stack';
import { OrdersAppStack } from '../lib/ordersApp-stack';
import { ECommerceApiStack } from '../lib/ecommerce-Api-stack';
import { InvoiceWSApiStack } from '../lib/invoiceWSApi-stack';
import { InvoicesAppLayeresStack } from '../lib/invoicesAppLayers-stack';
import { AuditEventBusStack } from 'lib/auditEventBus-stack';

const app = new cdk.App();

const env: cdk.Environment = {
    account: "631842816311",
    region: "us-east-1"
}

const tags = {
    cost: "Ecommerce",
    team: "Mz"
}

const auditEventBus = new AuditEventBusStack(app, "AuditEvents", {
    tags: {
        cost: "audit",
        team: "MZ"
    },
    env: env
})

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

const ordersAppLayerStack = new OrdersAppLayersStack(app, "OrdersAppLayers",{
    tags: tags,
    env: env
})

const ordersAppStack = new OrdersAppStack(app, "OrdersApp",{
    tags: tags,
    env: env,
    productsDdb: productsAppStack.productsDdb,
    eventDdb: eventsDbdStack.table,
    auditBus: auditEventBus.bus
})
ordersAppStack.addDependency(productsAppStack)
ordersAppStack.addDependency(ordersAppLayerStack)
ordersAppStack.addDependency(eventsDbdStack)
ordersAppStack.addDependency(auditEventBus)
 
const eCommerceApiStack = new ECommerceApiStack(app,"ECommerceApiGateway", {
    productsFetchHandler: productsAppStack.productsFetchHandler,
    productsAdminHandler: productsAppStack.productsAdminHandler,
    ordersHandler: ordersAppStack.ordersHandler,
    ordersEventsFetchHandler: ordersAppStack.orderEventsFetchHandler,
    tags: tags,
    env: env
})

eCommerceApiStack.addDependency(productsAppStack)
eCommerceApiStack.addDependency(ordersAppStack)

const invoicesAppLayeresStack = new InvoicesAppLayeresStack(app, "InvoicesAppLayer",{
    tags: {
        cost: "Ecomerce-Import-nf",
        team: "Mz"   
    },
    env: env
})

const invoiceWSApiStack = new InvoiceWSApiStack(app, "InvoiceApi", {
    eventDdb: eventsDbdStack.table,
    auditBus: auditEventBus.bus,
    tags: {
        cost: "Ecomerce-Import-nf",
        team: "Mz"   
    },
    env: env
})

invoiceWSApiStack.addDependency(invoiceWSApiStack)
invoiceWSApiStack.addDependency(eventsDbdStack)
invoiceWSApiStack.addDependency(auditEventBus)