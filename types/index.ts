export type UserRole = 'garcom' | 'administrador' | 'gerente' | 'cozinheiro';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  active: boolean;
}

export interface Dish {
  id: string;
  name: string;
  description?: string;
  category_id: string;
  category?: Category;
  price: number;
  image_url?: string;
  prep_time_minutes: number;
  active: boolean;
}

export type TableStatus = 'livre' | 'ocupada' | 'reservada' | 'fechando';

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: TableStatus;
  location?: string;
  active: boolean;
  current_order_id?: string;
}

export type OrderStatus = 'aberta' | 'fechando' | 'fechada' | 'cancelada';

export interface Order {
  id: string;
  table_id: string;
  table?: Table;
  waiter_id: string;
  waiter?: User;
  status: OrderStatus;
  customer_count: number;
  notes?: string;
  opened_at: string;
  closed_at?: string;
  total_amount: number;
  items?: OrderItem[];
}

export type ItemStatus = 'pendente' | 'recebido' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado';

export interface OrderItem {
  id: string;
  order_id: string;
  dish_id: string;
  dish?: Dish;
  quantity: number;
  unit_price: number;
  notes?: string;
  status: ItemStatus;
  requested_at: string;
  received_at?: string;
  started_at?: string;
  ready_at?: string;
  delivered_at?: string;
}

export interface KitchenQueueItem {
  item_id: string;
  order_id: string;
  table_number: number;
  waiter_name?: string;
  dish_name: string;
  dish_image_url?: string;
  quantity: number;
  notes?: string;
  status: ItemStatus;
  requested_at: string;
  started_at?: string;
}
