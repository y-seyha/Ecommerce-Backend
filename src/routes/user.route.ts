import { Router } from "express";
import { updateUserById } from "../controller/user.controller.js";

const router = Router();

// Update user by ID
router.put("/:id", updateUserById);

export default router;
