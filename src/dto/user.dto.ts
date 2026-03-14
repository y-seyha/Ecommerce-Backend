import { IUser } from "model/user.model.js";

export type UserRole = "customer" | "admin" | "seller";

export interface CreateUserDTO {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password: string;
  role?: UserRole;
}

export interface LoginUserDTO {
  email: string;
  password: string;
}

export interface UpdateUserDTO {
  first_name?: string;
  last_name?: string;
  password?: string;
  phone?: string;
  role?: UserRole;
}

export const createUser = (dto: CreateUserDTO): IUser => {
  return {
    id: null,
    first_name: dto.first_name,
    last_name: dto.last_name,
    email: dto.email,
    password: dto.password,
    role: dto.role || "customer", // default
    created_at: new Date(),
    updated_at: new Date(),
  };
};
