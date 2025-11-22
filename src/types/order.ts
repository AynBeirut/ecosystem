export interface OrderItem {
  productId: string
  quantity: number
  price?: number
}

export interface Order {
  id: string
  storeId?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  total?: number
  status?: string
  items?: OrderItem[]
  createdAt?: Date | string | number
}

export interface Customer {
  id: string
  name?: string
  email?: string
  createdAt?: Date | string | number
}
