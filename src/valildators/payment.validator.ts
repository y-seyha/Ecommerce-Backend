import { z, ZodObject, ZodRawShape } from "zod";

export class PaymentValidator {
  static createPaymentSchema: ZodObject<ZodRawShape> = z.object({
    body: z.object({
      order_id: z.coerce.number(),
      amount: z.number().min(0),
      method: z.string().trim().min(1),
      status: z.enum(["pending", "completed", "failed"]).optional(),
      paid_at: z.string().optional(),
    }),
    params: z.object({}),
    query: z.object({}),
  });

  static updatePaymentSchema: ZodObject<ZodRawShape> = z.object({
    params: z.object({ id: z.coerce.number() }),
    body: z.object({
      amount: z.number().min(0).optional(),
      method: z.string().trim().optional(),
      status: z.enum(["pending", "completed", "failed"]).optional(),
      paid_at: z.string().optional(),
    }),
    query: z.object({}),
  });

  static getPaymentByIdSchema: ZodObject<ZodRawShape> = z.object({
    params: z.object({ id: z.coerce.number() }),
    // body: z.object({}),
    // query: z.object({}),
  });

  static getByOrderIdSchema: ZodObject<ZodRawShape> = z.object({
    params: z.object({ order_id: z.coerce.number() }),
    body: z.object({}),
    query: z.object({}),
  });
}
