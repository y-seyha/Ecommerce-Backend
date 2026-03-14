import { z, ZodObject, ZodRawShape } from "zod";

export class UserValidator {
  static createUserSchema: ZodObject<ZodRawShape> = z.object({
    body: z.object({
      first_name: z.string().trim().min(2).max(50),
      last_name: z.string().trim().min(2).max(50),
      email: z.string().trim().email().toLowerCase(),
      password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
      role: z.enum(["customer", "admin", "seller"]).optional(),
      phone: z.string().optional(),
    }),
    params: z.object({}),
    query: z.object({}),
  });

  static loginSchema = z.object({
    body: z.object({
      email: z.string().trim().email().toLowerCase(),
      password: z.string().min(1, "Password is required"),
    }),
  });

  static updateUserSchema: ZodObject<ZodRawShape> = z.object({
    params: z.object({
      id: z.coerce.number(),
    }),
    body: z.object({
      first_name: z.string().trim().min(2).max(50).optional(),
      last_name: z.string().trim().min(2).max(50).optional(),
      email: z.string().trim().email().toLowerCase().optional(),
      password: z
        .string()
        .min(8)
        .regex(/[A-Z]/)
        .regex(/[a-z]/)
        .regex(/[0-9]/)
        .optional(),
      role: z.enum(["customer", "admin", "seller"]).optional(),
      phone: z.string().trim().min(6).max(20).optional(),
    }),
    query: z.object({}),
  });

  static getUserByIdSchema = z.object({
    params: z.object({
      id: z.coerce.number(),
    }),
  });
}
