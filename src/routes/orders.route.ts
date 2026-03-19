import { Router } from "express";
import { OrderController } from "controller/order.controller.js";
import { authMiddleware } from "middleware/authMiddleware.js";
import { authorizeRole } from "middleware/roleMiddleware.js";
import { authorizeOrderOwnerOrAdmin } from "middleware/authorizeOrderOwnerOrAdmin.middleware.js";
import { validate } from "middleware/validate.middleware.js";
import { OrderValidator } from "valildators/order.validator.js";

const router = Router();
const controller = new OrderController();

router.get(
  "/paginated",
  authMiddleware,
  authorizeRole("admin"),
  controller.getPaginated.bind(controller),
);

router.post(
  "/",
  authMiddleware,
  authorizeRole("customer", "admin", "seller"),
  // validate(OrderValidator.createOrderSchema),
  controller.create,
);

// ADMIN see all orders
router.get("/", authMiddleware, authorizeRole("admin"), controller.findAll);

// OWNER or ADMIN → view order
router.get(
  "/:id",
  authMiddleware,
  authorizeOrderOwnerOrAdmin(),
  validate(OrderValidator.getOrderByIdSchema),
  controller.findById,
);

// SELLER or ADMIN update order status
router.put(
  "/:id",
  authMiddleware,
  authorizeRole("seller", "admin"),
  validate(OrderValidator.updateOrderSchema),
  controller.update,
);

// ADMIN delete order
router.delete(
  "/:id",
  authMiddleware,
  authorizeRole("admin"),
  validate(OrderValidator.getOrderByIdSchema),
  controller.delete,
);

export default router;
