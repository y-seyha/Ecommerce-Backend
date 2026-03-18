export type UserRole = "customer" | "admin" | "seller";

export interface IUser {
  id: string; // UUID
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  is_verified: boolean;
  email_verification_otp?: string;
  email_verification_token?: string;
  email_verification_expires?: Date;
  password_reset_token?: string;
  password_reset_expires?: Date;
  created_at: Date;
  updated_at: Date;
}

export type AuthProvider = "credentials" | "google" | "github" | "facebook";

export interface IAccount {
  id: string;
  user_id: string;
  provider: AuthProvider;
  provider_account_id: string;
  password_hash?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: Date;

  created_at: Date;
}
