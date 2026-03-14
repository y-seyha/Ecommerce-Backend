import { Request, Response, NextFunction } from "express";
import { ReviewService } from "../service/review.service.js";
import { CreateReviewDTO, UpdateReviewDTO } from "../model/review.model.js";
import { Logger } from "utils/logger.js";
import { z } from "zod";
import { ReviewValidator } from "valildators/review.validar.js";
import { paginationSchema } from "valildators/pagination.validator.js";

// type CreateReviewBody = z.infer<
//   typeof ReviewValidator.createReviewSchema
// >["body"];
type UpdateReviewBody = z.infer<
  typeof ReviewValidator.updateReviewSchema
>["body"];

export interface CreateReviewBody {
  product_id: number;
  rating: number;
  comment?: string;
}

export class ReviewController {
  private service = new ReviewService();
  private logger = Logger.getInstance();

  create = async (
    req: Request<{}, {}, CreateReviewBody>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user_id = req.user?.id; // <- attach from authMiddleware

      if (!user_id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const dto: CreateReviewDTO = {
        ...req.body,
        user_id,
      };

      const review = await this.service.createReview(dto);
      res.status(201).json(review);
    } catch (error) {
      this.logger.error("Review Controller: Create Failed", error);
      next(error);
    }
  };

  update = async (
    req: Request<{ id: string }, {}, UpdateReviewBody>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const id = +req.params.id;
      const review = await this.service.updateReview(
        id,
        req.body as UpdateReviewDTO,
      );
      res.json(review);
    } catch (error) {
      this.logger.error("Review Controller: Update Failed", error);
      next(error);
    }
  };

  delete = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const id = +req.params.id;
      const success = await this.service.deleteReview(id);
      if (success) res.json({ message: "Deleted Successfully" });
      else res.status(404).json({ message: "Review not found" });
    } catch (error) {
      this.logger.error("Review Controller: Delete Failed", error);
      next(error);
    }
  };

  findAll = async (_: Request, res: Response, next: NextFunction) => {
    try {
      const reviews = await this.service.getAllReviews();
      res.json(reviews);
    } catch (error) {
      this.logger.error("Review Controller: FindAll Failed", error);
      next(error);
    }
  };

  findById = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const id = +req.params.id;
      const review = await this.service.getReviewById(id);
      if (review) res.json(review);
      else res.status(404).json({ message: "Review not found" });
    } catch (error) {
      this.logger.error("Review Controller: FindById Failed", error);
      next(error);
    }
  };

  findByProductId = async (
    req: Request<{ product_id: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const product_id = +req.params.product_id;
      const reviews = await this.service.getReviewsByProductId(product_id);
      res.json(reviews);
    } catch (error) {
      this.logger.error("Review Controller: FindByProductId Failed", error);
      next(error);
    }
  };

  findByUserId = async (
    req: Request<{ user_id: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user_id = +req.params.user_id;
      const reviews = await this.service.getReviewsByUserId(user_id);
      res.json(reviews);
    } catch (error) {
      this.logger.error("Review Controller: FindByUserId Failed", error);
      next(error);
    }
  };

  getAllPaginated = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize } = paginationSchema.parse({
        query: req.query,
      }).query;

      const result = await this.service.getReviewPaginated(page, pageSize);
      res.json(result);
    } catch (error) {
      this.logger.error("User Controller: GetAllPaginated Failed", error);
      next(error);
    }
  };
}
