import { Router } from "express";
import { UserController } from "../controller/user.controller.js";

const router = Router();
const controller = new UserController();

// Admin User CRUD
router.get("/", controller.getAllUsers);
router.get("/:id", controller.getUserById);
router.post("/", controller.createUser);
router.put("/:id", controller.updateUser);
router.delete("/:id", controller.deleteUser);

export default router;
