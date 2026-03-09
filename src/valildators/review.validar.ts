import { z, ZodObject, ZodRawShape } from "zod";

export class ReviewValidator {
  static createReviewSchema: ZodObject<ZodRawShape> = z.object({
    body: z.object({
      product_id: z.coerce.number(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().optional(),
    }),
    params: z.object({}),
    query: z.object({}),
  });

  static updateReviewSchema: ZodObject<ZodRawShape> = z.object({
    params: z.object({ id: z.coerce.number() }),
    body: z.object({
      rating: z.number().int().min(1).max(5).optional(),
      comment: z.string().optional(),
    }),
    query: z.object({}),
  });

  static getReviewByIdSchema: ZodObject<ZodRawShape> = z.object({
    params: z.object({ id: z.coerce.number() }),
    // body: z.object({}),
    // query: z.object({}),
  });

  static getByProductIdSchema: ZodObject<ZodRawShape> = z.object({
    params: z.object({ product_id: z.coerce.number() }),
    body: z.object({}).optional(),
    query: z.object({}),
  });

  static getByUserIdSchema: ZodObject<ZodRawShape> = z.object({
    params: z.object({ user_id: z.coerce.number() }),
    body: z.object({}).optional(),
    query: z.object({}),
  });
}
