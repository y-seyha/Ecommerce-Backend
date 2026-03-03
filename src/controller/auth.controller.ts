import { Request, Response, NextFunction } from "express";
import passport from "passport";
import { IUser, IAccount, IOAuthUserResponse } from "model/user.model.js";
import { UserService } from "service/user.service.js";

const userService = new UserService();

export class AuthController {
  //Google login
  googleLogin(req: Request, res: Response, next: NextFunction) {
    passport.authenticate("google", { scope: ["profile", "email"] })(
      req,
      res,
      next,
    );
  }

  // Google callback
  googleCallback(req: Request, res: Response, next: NextFunction) {
    passport.authenticate(
      "google",
      { session: false },
      async (err, user: IOAuthUserResponse | false, info) => {
        try {
          if (err || !user) {
            return res.status(401).json({
              success: false,
              message: "Google login failed",
              error: err || info,
            });
          }

          const { user: userData, account } = user;

          // Set cookie with accessToken from account
          if (account.access_token) {
            res.cookie("accessToken", account.access_token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "strict",
              maxAge: 24 * 60 * 60 * 1000, // 1 day
            });
          }

          res.json({
            success: true,
            data: userData,
            accessToken: account.access_token,
          });
        } catch (error) {
          next(error);
        }
      },
    )(req, res, next);
  }
  //Facebook
  facebookLogin(req: Request, res: Response, next: NextFunction) {
    passport.authenticate("facebook", { scope: ["email"] })(req, res, next);
  }

  facebookCallback(req: Request, res: Response, next: NextFunction) {
    passport.authenticate(
      "facebook",
      { session: false },
      async (err, user: IOAuthUserResponse | false, info) => {
        try {
          if (err || !user)
            return res
              .status(401)
              .json({
                success: false,
                message: "Facebook login failed",
                error: err || info,
              });

          const { user: userData, account } = user;

          if (account.access_token) {
            res.cookie("accessToken", account.access_token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "strict",
              maxAge: 24 * 60 * 60 * 1000,
            });
          }

          res.json({
            success: true,
            data: userData,
            accessToken: account.access_token,
          });
        } catch (error) {
          next(error);
        }
      },
    )(req, res, next);
  }

  //Github
  githubLogin(req: Request, res: Response, next: NextFunction) {
    passport.authenticate("github", { scope: ["user:email"] })(req, res, next);
  }

  githubCallback(req: Request, res: Response, next: NextFunction) {
    passport.authenticate(
      "github",
      { session: false },
      async (err, user: IOAuthUserResponse | false, info) => {
        try {
          if (err || !user)
            return res
              .status(401)
              .json({
                success: false,
                message: "GitHub login failed",
                error: err || info,
              });

          const { user: userData, account } = user;

          if (account.access_token) {
            res.cookie("accessToken", account.access_token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "strict",
              maxAge: 24 * 60 * 60 * 1000,
            });
          }

          res.json({
            success: true,
            data: userData,
            accessToken: account.access_token,
          });
        } catch (error) {
          next(error);
        }
      },
    )(req, res, next);
  }

  // Logout
  logout(req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie("accessToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      req.logout({ keepSessionInfo: false }, (err) => {
        if (err) return next(err);
        res
          .status(200)
          .json({ success: true, message: "Logged out successfully" });
      });
    } catch (error) {
      next(error);
    }
  }
}
