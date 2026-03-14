// export interface CreateOrderDTO {
//   user_id: number;
//   total_price: number;
//   status?: "pending" | "completed" | "cancelled";
//   shipping_name?: string;
//   shipping_phone?: string;
//   shipping_address?: string;
//   shipping_city?: string;
// }

// export interface UpdateOrderDTO {
//   total_price?: number;
//   status?: "pending" | "completed" | "cancelled";
//   user_id?: number;
//   shipping_name?: string;
//   shipping_phone?: string;
//   shipping_address?: string;
//   shipping_city?: string;
// }

// export interface CreateOrderDTO {
//   user_id: number;
//   total_price: number;
//   status?: string;
//   shipping_name?: string;
//   shipping_phone?: string;
//   shipping_address?: string;
//   shipping_city?: string;
//   payment_method?: "cod" | "card";
//   items: { product_id: number; quantity: number; price: number }[]; // required
// }
// src/dto/orders.dto.ts
export interface OrderItemDTO {
  product_id: number;
  quantity: number;
  price: number;
}

export interface CreateOrderDTO {
  user_id: number;
  total_price: number;
  status?: "pending" | "completed" | "cancelled";
  shipping_name?: string;
  shipping_phone?: string;
  shipping_address?: string;
  shipping_city?: string;
  payment_method?: "cod" | "card";
  items: OrderItemDTO[];
}

export interface UpdateOrderDTO {
  id?: number;
  user_id: number;
  total_price?: number;
  status?: "pending" | "completed" | "cancelled";
  shipping_name?: string;
  shipping_phone?: string;
  shipping_address?: string;
  shipping_city?: string;
}
