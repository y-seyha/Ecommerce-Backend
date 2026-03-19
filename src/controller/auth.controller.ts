import { Request, Response } from "express";
import { google } from "googleapis";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { IAccount, IUser, UserRole } from "model/user.model.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "utils/mailer.js";
import { Database } from "Configuration/database.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "utils/jwt.js";
// import { generateOTP, sendOTPEmail } from "utils/resend.js";

const pool = Database.getInstance();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL,
);

const FACEBOOK_CLIENT_ID = process.env.FACEBOOK_CLIENT_ID!;
const FACEBOOK_CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET!;
const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_CALLBACK_URL!;

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const GITHUB_REDIRECT_URI = process.env.GITHUB_CALLBACK_URL!;

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface FacebookUserResponse {
  id: string;
  name: string;
  email: string;
  picture?: { data: { url: string } };
}

export const register = async (req: Request, res: Response) => {
  const { email, first_name, last_name, password, role } = req.body;

  try {
    // Hash the password
    const password_hash = await bcrypt.hash(password, 10);

    // Generate email verification token
    const email_verification_token = crypto.randomBytes(32).toString("hex");
    const email_verification_expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // Insert user
    const userResult = await pool.query<IUser>(
      `INSERT INTO users
       (email, first_name, last_name, role, is_verified, email_verification_token, email_verification_expires, created_at, updated_at)
       VALUES ($1,$2,$3,$4,FALSE,$5,$6,NOW(),NOW())
       RETURNING *`,
      [
        email,
        first_name || null,
        last_name || null,
        (role as UserRole) || "customer",
        email_verification_token,
        email_verification_expires,
      ],
    );

    const user = userResult.rows[0];

    // Insert credentials account
    await pool.query<IAccount>(
      `INSERT INTO accounts
       (user_id, provider, provider_account_id, password_hash, created_at)
       VALUES ($1,'credentials',$2,$3,NOW())`,
      [user.id, email, password_hash],
    );

    // Send verification email
    await sendVerificationEmail(email, email_verification_token);

    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
      user,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyEmailHandler = async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== "string")
    return res.status(400).send("<h3>Invalid token</h3>");

  try {
    const userResult = await pool.query<IUser>(
      `SELECT * FROM users
       WHERE email_verification_token = $1
       AND email_verification_expires > NOW()`,
      [token],
    );

    const user = userResult.rows[0];
    if (!user) return res.status(400).send("<h3>Invalid or expired token</h3>");

    // Update user to mark as verified
    await pool.query(
      `UPDATE users
       SET is_verified = TRUE,
           email_verification_token = NULL,
           email_verification_expires = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id],
    );

    res.send(`
      <h2>Email Verified Successfully </h2>
      <p>Your account is now active. You can login using your credentials.</p>
    `);
  } catch (err: any) {
    console.error(err);
    res.status(500).send("<h3>Internal server error</h3>");
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // Fetch account + user fields from DB
    const result = await pool.query(
      `SELECT 
         a.id as account_id,
         a.user_id,
         a.provider,
         a.provider_account_id,
         a.password_hash,
         a.access_token,
         a.refresh_token,
         a.token_expires_at,
         a.created_at as account_created_at,
         u.id as user_id,
         u.email,
         u.first_name,
         u.last_name,
         u.role,
         u.phone,
         u.avatar_url,
         u.is_verified,
         u.email_verification_token,
         u.email_verification_expires,
         u.password_reset_token,
         u.password_reset_expires,
         u.created_at as user_created_at,
         u.updated_at
       FROM accounts a
       JOIN users u ON u.id = a.user_id
       WHERE a.provider = 'credentials' AND a.provider_account_id = $1`,
      [email],
    );

    const row = result.rows[0];
    if (!row) return res.status(400).json({ message: "Invalid credentials" });

    // Map account
    const account: IAccount = {
      id: row.account_id,
      user_id: row.user_id,
      provider: row.provider,
      provider_account_id: row.provider_account_id,
      password_hash: row.password_hash,
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      token_expires_at: row.token_expires_at,
      created_at: row.account_created_at,
    };

    // Map user
    const user: IUser = {
      id: row.user_id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      role: row.role,
      phone: row.phone,
      avatar_url: row.avatar_url,
      is_verified: row.is_verified,
      email_verification_token: row.email_verification_token,
      email_verification_expires: row.email_verification_expires,
      password_reset_token: row.password_reset_token,
      password_reset_expires: row.password_reset_expires,
      created_at: row.user_created_at,
      updated_at: row.updated_at,
    };

    // Check password
    const match = await bcrypt.compare(password, account.password_hash!);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    // Check email verification
    if (!user.is_verified)
      return res
        .status(403)
        .json({ message: "Please verify your email first" });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      role: user.role,
    });

    // Set refresh token cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 15 * 60 * 1000, // 15 min
    });

    // Send refresh token in HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // true in prod
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return tokens + user info
    res.json({ accessToken, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const forgotPasswordHandler = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query<IUser>(
      `SELECT * FROM users WHERE email = $1`,
      [email],
    );
    const user = userResult.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 1000 * 60 * 30); // 30 min

    const updateResult = await client.query<IUser>(
      `UPDATE users
       SET password_reset_token = $1,
           password_reset_expires = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, password_reset_token, password_reset_expires`,
      [resetToken, resetExpires, user.id],
    );

    if (updateResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res
        .status(500)
        .json({ message: "Failed to set password reset token" });
    }

    await client.query("COMMIT");

    // Send email after commit
    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: "Password reset email sent" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const resetPasswordHandler = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ message: "Token and new password required" });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `SELECT * FROM users 
       WHERE password_reset_token = $1 AND password_reset_expires > NOW()`,
      [token],
    );

    const user = userResult.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateAccount = await client.query(
      `UPDATE accounts 
       SET password_hash = $1 
       WHERE user_id = $2 AND provider = 'credentials'`,
      [hashedPassword, user.id],
    );

    if (updateAccount.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(500).json({ message: "No credentials account found" });
    }

    await client.query(
      `UPDATE users 
       SET password_reset_token = NULL, password_reset_expires = NULL
       WHERE id = $1`,
      [user.id],
    );

    await client.query("COMMIT");

    res.json({ message: "Password reset successful. You can now login." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

export async function logoutHandler(_req: Request, res: Response) {
  res.clearCookie("refreshToken", { path: "/" });

  return res.status(200).json({
    message: "Logged out",
  });
}

export const googleLoginHandler = async (_req: Request, res: Response) => {
  const scopes = ["profile", "email"];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // request refresh token
    scope: scopes,
    prompt: "consent", // force consent to get refresh token
  });

  res.redirect(url); // redirect user to Google login
};

export const googleCallbackHandler = async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send("Code not provided");

  try {
    // 1. Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 2. Get user info from Google
    const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
    const { data } = await oauth2.userinfo.get();
    const email = data.email!;
    const fullName = data.name!; // full name from Google
    const avatar = data.picture;

    // Split full name into first and last
    const [first_name, ...rest] = fullName.split(" ");
    const last_name = rest.join(" ") || null;

    // 3. Check if user exists by email
    let userResult = await pool.query(`SELECT * FROM users WHERE email = $1`, [
      email,
    ]);

    let user = userResult.rows[0];

    if (!user) {
      // 4. User doesn't exist → create user
      const userInsert = await pool.query(
        `INSERT INTO users (email, first_name, last_name, role, avatar_url, is_verified)
         VALUES ($1, $2, $3, 'customer', $4, TRUE)
         RETURNING *`,
        [email, first_name, last_name, avatar],
      );
      user = userInsert.rows[0];
    }

    // 5. Check if Google account exists
    const accountResult = await pool.query(
      `SELECT * FROM accounts WHERE user_id = $1 AND provider = 'google'`,
      [user.id],
    );

    if (!accountResult.rows[0]) {
      // Create Google account linked to existing user
      await pool.query(
        `INSERT INTO accounts (user_id, provider, provider_account_id, access_token, refresh_token, token_expires_at)
         VALUES ($1, 'google', $2, $3, $4, $5)`,
        [
          user.id,
          email,
          tokens.access_token,
          tokens.refresh_token,
          tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        ],
      );
    }

    // 6. Generate JWT
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      role: user.role,
    });

    // 7. Set refresh token cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 8. Redirect to frontend OAuth success page
    res.redirect("http://localhost:5173/oauth-success");
  } catch (err: any) {
    console.error(err);
    res.status(500).send("Google OAuth failed");
  }
};

export const facebookLoginHandler = async (_req: Request, res: Response) => {
  const fbAuthUrl = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${FACEBOOK_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    FACEBOOK_REDIRECT_URI,
  )}&scope=email,public_profile&response_type=code&auth_type=rerequest`;

  res.redirect(fbAuthUrl);
};

export const facebookCallbackHandler = async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send("Code not provided");

  const client = await pool.connect();

  try {
    // Exchange code for access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v17.0/oauth/access_token?client_id=${FACEBOOK_CLIENT_ID}&redirect_uri=${encodeURIComponent(
        FACEBOOK_REDIRECT_URI,
      )}&client_secret=${FACEBOOK_CLIENT_SECRET}&code=${code}`,
    );
    const tokenData: FacebookTokenResponse = await tokenRes.json();

    //  Fetch Facebook user info
    const userRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${tokenData.access_token}`,
    );
    const fbUser: FacebookUserResponse = await userRes.json();

    if (!fbUser.email) throw new Error("Facebook email not provided");

    const email = fbUser.email;
    const name = fbUser.name || "";
    const avatar = fbUser.picture?.data?.url;

    // Split full name into first_name and last_name
    const [first_name, ...rest] = name.split(" ");
    const last_name = rest.join(" ") || null;

    await client.query("BEGIN");

    // Check if Facebook account already exists
    const accountResult = await client.query(
      `SELECT a.*, u.id as user_id, u.email, u.first_name, u.last_name, u.role, u.avatar_url
   FROM accounts a
   JOIN users u ON u.id = a.user_id
   WHERE a.provider = 'facebook' AND a.provider_account_id = $1`,
      [email],
    );

    let user = accountResult.rows[0];

    if (user) {
      // Account exists → just update access token
      await client.query(
        `UPDATE accounts SET access_token = $1 WHERE provider = 'facebook' AND provider_account_id = $2`,
        [tokenData.access_token, email],
      );
      // Map flat columns to user object
      user = {
        id: user.user_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        avatar_url: user.avatar_url,
      };
    } else {
      // Account does not exist → check if a user exists with this email
      const existingUserResult = await client.query(
        `SELECT * FROM users WHERE email = $1`,
        [email],
      );
      user = existingUserResult.rows[0];

      // If no user → create new user
      if (!user) {
        const userInsert = await client.query(
          `INSERT INTO users (email, first_name, last_name, is_verified, role, avatar_url)
           VALUES ($1, $2, $3, TRUE, 'customer', $4) RETURNING *`,
          [email, first_name, last_name, avatar],
        );
        user = userInsert.rows[0];
      }

      // Create Facebook account linked to this user
      await client.query(
        `INSERT INTO accounts (user_id, provider, provider_account_id, access_token)
         VALUES ($1, 'facebook', $2, $3)`,
        [user.id, email, tokenData.access_token],
      );
    }

    await client.query("COMMIT");

    //  Generate JWT tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      role: user.role,
    });

    //  Set refresh token in HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 6. Redirect to frontend
    res.redirect("http://localhost:5173/oauth-success");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send("Facebook OAuth failed");
  } finally {
    client.release();
  }
};

export const githubLoginHandler = async (_req: Request, res: Response) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    GITHUB_REDIRECT_URI,
  )}&scope=user:email`;

  res.redirect(githubAuthUrl);
};

export const githubCallbackHandler = async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send("Code not provided");

  const client = await pool.connect();

  try {
    // Exchange code for access token
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_REDIRECT_URI,
        }),
      },
    );

    const tokenData: { access_token: string } = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("GitHub access token missing");

    // Fetch user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${tokenData.access_token}` },
    });
    const githubUser: {
      id: number;
      login: string;
      email: string | null;
      avatar_url: string;
    } = await userRes.json();

    // GitHub sometimes hides email, fetch public emails if null
    let email = githubUser.email;
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `token ${tokenData.access_token}` },
      });
      const emails: { email: string; primary: boolean; verified: boolean }[] =
        await emailsRes.json();
      const primaryEmail = emails.find((e) => e.primary && e.verified);
      email = primaryEmail?.email || emails[0]?.email;
    }

    if (!email) throw new Error("GitHub email not found");

    await client.query("BEGIN");

    // Check if user exists by email
    let userResult = await client.query(
      `SELECT * FROM users WHERE email = $1`,
      [email],
    );
    let user = userResult.rows[0];

    if (!user) {
      // Email doesn't exist → create user
      const userInsert = await client.query(
        `INSERT INTO users (email, first_name, last_name, is_verified, role, avatar_url, created_at, updated_at)
         VALUES ($1, $2, $3, TRUE, 'customer', $4, NOW(), NOW()) RETURNING *`,
        [email, githubUser.login, null, githubUser.avatar_url],
      );
      user = userInsert.rows[0];
    }

    // Check if GitHub account exists
    const accountResult = await client.query(
      `SELECT * FROM accounts WHERE user_id = $1 AND provider = 'github'`,
      [user.id],
    );

    if (!accountResult.rows[0]) {
      // Create GitHub account for existing user
      await client.query(
        `INSERT INTO accounts (user_id, provider, provider_account_id, access_token, created_at)
         VALUES ($1, 'github', $2, $3, NOW())`,
        [user.id, email, tokenData.access_token],
      );
    }

    await client.query("COMMIT");

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      role: user.role,
    });

    // Set refresh token as HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.redirect("http://localhost:5173/oauth-success");
    // res.json({
    //   message: "GitHub login successful",
    //   accessToken,
    //   user: {
    //     id: user.id,
    //     email: user.email,
    //     first_name: user.first_name,
    //     last_name: user.last_name,
    //     role: user.role,
    //     avatar_url: user.avatar_url,
    //   },
    // });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).send("GitHub OAuth failed");
  } finally {
    client.release();
  }
};

export const refreshTokenHandler = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken; // make sure you use cookie-parser middleware
    if (!token)
      return res.status(401).json({ message: "No refresh token provided" });

    // Verify refresh token
    let payload: any;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }

    // Optional: check if user still exists
    const userResult = await pool.query(`SELECT * FROM users WHERE id = $1`, [
      payload.userId,
    ]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate new tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      role: user.role,
    });

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60 * 1000, // 15 min
    });

    // Set new refresh token in HttpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const meHandler = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const payload: any = verifyAccessToken(token);
    const userResult = await pool.query(
      `SELECT id, email, first_name, last_name, role, is_verified, avatar_url, phone
       FROM users WHERE id = $1`,
      [payload.userId],
    );

    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// export const register = async (req: Request, res: Response) => {
//   const { email, first_name, last_name, password, role } = req.body;

//   try {
//     // Hash the password
//     const password_hash = await bcrypt.hash(password, 10);

//     // Generate 6-digit OTP
//     const otp = generateOTP();
//     const otp_expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

//     //  Insert user with OTP (instead of token)
//     const userResult = await pool.query<IUser>(
//       `INSERT INTO users
//        (email, first_name, last_name, role, is_verified, email_verification_otp, email_verification_expires, created_at, updated_at)
//        VALUES ($1,$2,$3,$4,FALSE,$5,$6,NOW(),NOW())
//        RETURNING *`,
//       [
//         email,
//         first_name || null,
//         last_name || null,
//         (role as UserRole) || "customer",
//         otp,
//         otp_expires_at,
//       ],
//     );

//     const user = userResult.rows[0];

//     //  Insert credentials
//     await pool.query<IAccount>(
//       `INSERT INTO accounts
//        (user_id, provider, provider_account_id, password_hash, created_at)
//        VALUES ($1,'credentials',$2,$3,NOW())`,
//       [user.id, email, password_hash],
//     );

//     //  Send OTP email
//     await sendOTPEmail(email, otp);

//     res.status(201).json({
//       message:
//         "User registered successfully. Please check your email for the OTP.",
//       user: {
//         id: user.id,
//         email: user.email,
//         first_name: user.first_name,
//         last_name: user.last_name,
//       },
//     });
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// /**
//  * Verify email with OTP
//  */
// export const verifyEmailHandler = async (req: Request, res: Response) => {
//   const { email, otp } = req.body;

//   if (!email || !otp)
//     return res.status(400).send("<h3>Email and OTP are required</h3>");

//   try {
//     //  Get user by email and check OTP + expiry
//     const userResult = await pool.query<IUser>(
//       `SELECT * FROM users
//        WHERE email = $1
//        AND email_verification_otp = $2
//        AND email_verification_expires > NOW()`,
//       [email, otp],
//     );

//     const user = userResult.rows[0];
//     if (!user) return res.status(400).send("<h3>Invalid or expired OTP</h3>");

//     //  Mark user as verified
//     await pool.query(
//       `UPDATE users
//        SET is_verified = TRUE,
//            email_verification_otp = NULL,
//            email_verification_expires = NULL,
//            updated_at = NOW()
//        WHERE id = $1`,
//       [user.id],
//     );

//     res.send(`
//       <h2>Email Verified Successfully</h2>
//       <p>Your account is now active. You can login using your credentials.</p>
//     `);
//   } catch (err: any) {
//     console.error(err);
//     res.status(500).send("<h3>Internal server error</h3>");
//   }
// };
