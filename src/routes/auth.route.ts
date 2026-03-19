import { Router } from "express";
import {
  register,
  login,
  verifyEmailHandler,
  googleLoginHandler,
  googleCallbackHandler,
  facebookLoginHandler,
  facebookCallbackHandler,
  githubLoginHandler,
  githubCallbackHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  logoutHandler,
  refreshTokenHandler,
  meHandler,
} from "../controller/auth.controller.js";

import { validate } from "../middleware/validate.middleware.js";
import {
  loginValidator,
  registerValidator,
  verifyEmailValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  googleCallbackValidator,
  facebookCallbackValidator,
  githubCallbackValidator,
} from "../valildators/auth.validation.js";

const router = Router();

// Auth routes
router.post("/register", register);
router.post("/login", validate(loginValidator), login);
// router.get("/verify-email", validate(verifyEmailValidator), verifyEmailHandler);
router.get("/verify-email", verifyEmailHandler);
router.get("/me", meHandler);

//  Forgot & Reset password
router.post(
  "/forgot-password",
  validate(forgotPasswordValidator),
  forgotPasswordHandler,
);
router.post(
  "/reset-password",
  validate(resetPasswordValidator),
  resetPasswordHandler,
);

// Logout & Refresh token
router.post("/logout", logoutHandler);
router.get("/refresh-token", refreshTokenHandler);

//  Social logins
router.get("/google", googleLoginHandler);
router.get(
  "/google/callback",
  // validate(googleCallbackValidator),
  googleCallbackHandler,
);

router.get("/facebook", facebookLoginHandler);
router.get(
  "/facebook/callback",
  // validate(facebookCallbackValidator),
  facebookCallbackHandler,
);

router.get("/github", githubLoginHandler);
router.get(
  "/github/callback",
  // validate(githubCallbackValidator),
  githubCallbackHandler,
);

export default router;
