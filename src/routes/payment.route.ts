import { Router } from "express";
import { PaymentController } from "../controller/payment.controller.js";
import { authMiddleware } from "middleware/authMiddleware.js";
import { authorizeRole } from "middleware/roleMiddleware.js";
import { authorizePaymentOwnerOrAdmin } from "middleware/authorizePaymentOwnerOrAdmin.middleware.js";
import { validate } from "middleware/validate.middleware.js";
import { PaymentValidator } from "../valildators/payment.validator.js";

const router = Router();
const controller = new PaymentController();
router.get(
  "/paginated",
  authMiddleware,
  authorizeRole("admin"),
  controller.getPaginated.bind(controller),
);
// CUSTOMER  create payment
router.post(
  "/",
  authMiddleware,
  authorizeRole("customer"),
  validate(PaymentValidator.createPaymentSchema),
  controller.create,
);

// ADMIN  update
router.put(
  "/:id",
  authMiddleware,
  authorizeRole("admin"),
  validate(PaymentValidator.updatePaymentSchema),
  controller.update,
);

// ADMIN  delete
router.delete(
  "/:id",
  authMiddleware,
  authorizeRole("admin"),
  validate(PaymentValidator.getPaymentByIdSchema),
  controller.delete,
);

// ADMIN  view all
router.get("/", authMiddleware, authorizeRole("admin"), controller.findAll);

// OWNER or ADMIN → view payment
router.get(
  "/:id",
  authMiddleware,
  validate(PaymentValidator.getPaymentByIdSchema),
  controller.findById,
);

// OWNER or ADMIN → view by order
router.get(
  "/order/:order_id",
  authMiddleware,
  validate(PaymentValidator.getByOrderIdSchema),
  controller.findByOrderId,
);



export default router;
