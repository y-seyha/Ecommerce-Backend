import { Router } from "express";
import { SellerController } from "../controller/seller.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { authorizeRole } from "../middleware/roleMiddleware.js";

const router = Router();
const controller = new SellerController();

router.get(
  "/me",
  authMiddleware,
  authorizeRole("seller"),
  controller.getMyStore,
);

router.put(
  "/me",
  authMiddleware,
  authorizeRole("seller"),
  controller.updateMyStore,
);

router.get("/:id", authMiddleware, controller.getSellerById);

router.put("/become", authMiddleware, controller.becomeSeller);

export default router;
