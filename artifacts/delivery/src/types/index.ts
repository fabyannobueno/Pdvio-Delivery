export interface OperatingHour {
  day: number | string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface Company {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  delivery_enabled: boolean;
  delivery_slug: string;
  delivery_description?: string;
  delivery_logo_url?: string;
  delivery_cover_url?: string;
  delivery_fee: number;
  delivery_min_order: number;
  delivery_free_threshold?: number;
  delivery_time?: string;
  delivery_pickup_time?: string;
  delivery_primary_color: string;
  delivery_whatsapp?: string;
  delivery_instagram?: string;
  delivery_facebook?: string;
  delivery_tiktok?: string;
  delivery_twitter?: string;
  delivery_youtube?: string;
  delivery_linkedin?: string;
  delivery_telegram?: string;
  delivery_site?: string;
  delivery_operating_hours?: OperatingHour[];
  delivery_rating?: number;
  delivery_rating_count?: number;
  payment_settings?: { enabled: string[] };
  wapi_instance_id?: string;
  wapi_token?: string;
}

export interface ProductAddon {
  id: string;
  product_id: string;
  name: string;
  price: number;
  sort_order: number;
}

export interface Product {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  category?: string;
  sale_price: number;
  stock_unit: string;
  stock_quantity?: number;
  is_active: boolean;
  is_promotion: boolean;
  promotion_price?: number;
  promotion_start?: string;
  promotion_end?: string;
  image_url?: string;
  product_addons?: ProductAddon[];
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  selectedAddons: Array<{ id: string; name: string; price: number }>;
  totalPrice: number;
  imageUrl?: string;
  unit: string;
  weight?: number;
  stockQuantity?: number;
}

export interface Sale {
  id: string;
  company_id: string;
  numeric_id?: number;
  subtotal: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  payment_amount: number;
  change_for?: number | null;
  change_amount?: number | null;
  notes?: string;
  status: string;
  created_at: string;
  sale_items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  subtotal: number;
  addons: Array<{ id: string; name: string; price: number }>;
  notes?: string;
}

export type PaymentMethod =
  | "pix"
  | "cash"
  | "credit_card"
  | "debit_card"
  | "ticket";

export type DeliveryType = "delivery" | "pickup" | "dine_in";

export type DeliveryOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "cancelled"
  | "out_for_delivery"
  | "delivered"
  | "ready_for_pickup"
  | "picked_up";

export interface DeliveryOrder {
  id: string;
  numeric_id?: number;
  company_id: string;
  customer_name: string;
  customer_phone: string;
  address?: string;
  delivery_type: DeliveryType;
  table_identifier?: string;
  comanda_id?: string;
  items: CartItem[];
  subtotal: number;
  delivery_fee: number;
  discount_amount?: number;
  total: number;
  payment_method: string;
  notes?: string;
  status: DeliveryOrderStatus;
  created_at: string;
}

export interface OrderReview {
  id: string;
  company_id: string;
  order_id?: string;
  order_numeric_id?: number;
  customer_name?: string;
  delivery_type?: string;
  table_identifier?: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface MesaParams {
  mesa: string;
  empresa: string;
  comanda?: string;
}
