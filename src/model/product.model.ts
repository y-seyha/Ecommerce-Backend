export interface Product {
  id?: string;
  user_id?: string;
  name: string;
  description?: string;
  price: number;
  stock?: number;
  category_id?: number;
  created_at?: Date;
  updated_at?: Date;
  image_url?: string | null;
  image_public_id?: string | null;
}
