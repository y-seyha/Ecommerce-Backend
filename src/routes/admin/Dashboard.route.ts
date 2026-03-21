import { Router } from "express";
import { AdminDashboardController } from "../../controller/admin/Dashboard.controller.js";
import { authMiddleware } from "middleware/authMiddleware.js";

const router = Router();
const controller = new AdminDashboardController();

router.get("/dashboard", authMiddleware, controller.getDashboard);

export default router;
