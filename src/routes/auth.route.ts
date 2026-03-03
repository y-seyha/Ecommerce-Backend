import { Request, Router, Response } from "express";
import { AuthController } from "controller/auth.controller.js";

const router = Router();
const authController = new AuthController();

// GOOGLE 
router.get("/google", authController.googleLogin.bind(authController));
router.get("/google/callback", authController.googleCallback.bind(authController));

// facebook
router.get("/facebook", authController.facebookLogin.bind(authController));
router.get("/facebook/callback", authController.facebookCallback.bind(authController));

// github  
router.get("/github", authController.githubLogin.bind(authController));
router.get("/github/callback", authController.githubCallback.bind(authController));

//logout
router.post("/logout", authController.logout.bind(authController));

export default router;