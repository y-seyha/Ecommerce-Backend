import passport from "passport";
import { UserService } from "service/user.service.js";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as GitHubStrategy } from "passport-github2";
import { IOAuthUserResponse } from "model/user.model.js";
import { Logger } from "../utils/logger.js";

const userService = new UserService();
const logger = Logger.getInstance();

// Gmail
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile.emails || profile.emails.length === 0) {
          logger.warn("Google OAuth failed: no email found", { profile });
          return done(new Error("No email found in Google profile"));
        }

        const email = profile.emails[0].value;
        const name = profile.displayName || "";
        const providerAccountId = profile.id;

        const fullName = profile.displayName || "";
        let first_name = "";
        let last_name = "";

        if (fullName) {
          const nameParts = fullName.trim().split(" ");
          first_name = nameParts[0];
          last_name = nameParts.slice(1).join(" "); // join the rest as last name
        }

        // Use the new service method
        const user = await userService.findOrCreateSocialUser({
          email,
          name,
          first_name,
          last_name,
          provider: "google",
          providerAccountId,
          accessToken,
          refreshToken,
        });

        logger.info("Google OAuth successful", { email, id: user.id });

        // Build response combining user + account
        const response: IOAuthUserResponse = {
          user,
          account: {
            userId: user.id!,
            provider: "google",
            provider_account_id: providerAccountId,
            access_token: accessToken,
            refresh_token: refreshToken,
          },
        };

        return done(null, response);
      } catch (error) {
        logger.error("Google OAuth error", { error });
        return done(new Error("Google login failed"), false);
      }
    },
  ),
);

// Facebook
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL!,
      profileFields: ["id", "email", "name"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const firstName =
          profile.name?.givenName || profile.displayName?.split(" ")[0] || "";
        const lastName =
          profile.name?.familyName ||
          profile.displayName?.split(" ").slice(1).join(" ") ||
          "";

        const fullName = `${firstName} ${lastName}`.trim();
        const email = profile.emails?.[0]?.value || "";

        const user = await userService.findOrCreateSocialUser({
          email,
          name: fullName,
          provider: "facebook",
          providerAccountId: profile.id,
          accessToken,
          refreshToken,
        });

        logger.info("Facebook OAuth successful", { email, id: user.id });

        return done(null, {
          user,
          account: {
            userId: user.id!,
            provider: "facebook",
            provider_account_id: profile.id,
            access_token: accessToken,
            refresh_token: refreshToken,
          },
        });
      } catch (error) {
        logger.error("Facebook OAuth error", { error });
        return done(error, false);
      }
    },
  ),
);

// Github
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: process.env.GITHUB_CALLBACK_URL!,
      scope: ["user:email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await userService.findOrCreateSocialUser({
          email: profile.emails?.[0].value || "",
          name: profile.displayName || profile.username,
          provider: "github",
          providerAccountId: profile.id,
          accessToken,
          refreshToken,
        });

        logger.info("GitHub OAuth successful", {
          email: user.email,
          id: user.id,
        });

        return done(null, {
          user,
          account: {
            userId: user.id!,
            provider: "github",
            provider_account_id: profile.id,
            access_token: accessToken,
            refresh_token: refreshToken,
          },
        });
      } catch (error) {
        logger.error("GitHub OAuth error", { error });
        done(error, false);
      }
    },
  ),
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, {
    id: user.user.id,
    email: user.user.email,
    role: user.user.role,
  });
});

// Deserialize user from session
passport.deserializeUser(async (userSession: any, done) => {
  try {
    const user = await userService.getUserById(userSession.id);
    done(null, user);
  } catch (err) {
    logger.error("Deserialize user failed", { error: err });
    done(err, null);
  }
});

export default passport;
