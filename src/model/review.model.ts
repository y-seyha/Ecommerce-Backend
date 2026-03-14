export interface Review {
  id?: number;
  user_id: number;
  product_id: number;
  rating: number; // 1 - 5
  comment?: string;
  created_at?: Date;
}

export interface CreateReviewDTO {
  id?: number;
  user_id: number;
  product_id: number;
  rating: number; // 1-5
  comment?: string;
}

export interface UpdateReviewDTO {
  rating?: number; //  1-5
  comment?: string;
  id?: number;
}
