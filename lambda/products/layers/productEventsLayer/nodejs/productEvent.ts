export enum ProductEventType {
    CREATED = "PRODUTO_CRIADO",
    UPDATED = "PRODUTO_ALTERADO",
    DELETED = "PRODUTO_DELETADO"
}


export interface ProductEvent {
    requestId: string,
    eventType: ProductEventType,
    productId: string, 
    productCode: string, 
    productPrice: number,
    email: string 
}