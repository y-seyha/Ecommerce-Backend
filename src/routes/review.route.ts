import { Router } from "express";
import { ReviewController } from "../controller/review.controller.js";
import { authMiddleware } from "middleware/authMiddleware.js";
import { authorizeRole } from "middleware/roleMiddleware.js";
import { authorizeReviewOwnerOrAdmin } from "middleware/authorizeReviewOwnerOrAdmin.middleware.js";
import { validate } from "middleware/validate.middleware.js";
import { ReviewValidator } from "valildators/review.validar.js";

const router = Router();
const controller = new ReviewController();
router.get(
  "/paginated",
  authMiddleware,
  // authorizeRole("admin"),
  controller.getAllPaginated.bind(controller),
);
// Public routes
router.get("/", controller.findAll);

router.get(
  "/:id",
  validate(ReviewValidator.getReviewByIdSchema),
  controller.findById,
);
router.get(
  "/product/:product_id",
  validate(ReviewValidator.getByProductIdSchema),
  controller.findByProductId,
);
router.get(
  "/user/:user_id",
  validate(ReviewValidator.getByUserIdSchema),
  controller.findByUserId,
);

// CUSTOMER create review
router.post(
  "/",
  authMiddleware,
  authorizeRole("customer"),
  validate(ReviewValidator.createReviewSchema),
  controller.create,
);

// OWNER or ADMIN update review
router.put(
  "/:id",
  authMiddleware,
  // authorizeReviewOwnerOrAdmin(),
  validate(ReviewValidator.updateReviewSchema),
  controller.update,
);

// OWNER or ADMIN delete review
router.delete(
  "/:id",
  authMiddleware,
  // authorizeReviewOwnerOrAdmin(),
  validate(ReviewValidator.getReviewByIdSchema),
  controller.delete,
);

export default router;
