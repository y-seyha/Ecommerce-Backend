export interface Seller {
  id?: string;
  user_id: string;
  store_name: string;
  store_description?: string;
  store_address?: string;
  phone?: string;
  logo_url?: string;
  created_at?: Date;
  updated_at?: Date;
}
