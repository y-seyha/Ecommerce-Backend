import express from "express";

import userRoute from "./routes/user.route.js";
import productRoute from "./routes/product.route.js";
import categoryRoutes from "./routes/category.route.js";
import adminRoutes from "./routes/admin/Dashboard.route.js";
import cartRoutes from "./routes/cart.route.js";
import cartItemRoutes from "./routes/cartItem.route.js";
import ordersRoute from "./routes/orders.route.js";
import orderItemRoutes from "./routes/orderItem.route.js";
import paymentRoutes from "./routes/payment.route.js";
import reviewRoutes from "./routes/review.route.js";
import sellerRoutes from "./routes/seller.route.js";
import checkout from "./routes/checkout.route.js";

import authRoutes from "./routes/auth.route.js";
import session, { SessionOptions } from "express-session";

import {
  corsMiddleware,
  errorHandler,
  globalRateLimiter,
  helmetMiddleware,
} from "middleware/global.middleware.js";
import cookieParser from "cookie-parser";
import passport from "passport";

const app = express();

app.use(corsMiddleware);
app.use(helmetMiddleware);

// 2. Trust proxy
app.set("trust proxy", 1);

app.use(globalRateLimiter);

// app.options("*", corsMiddleware);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

const sessionOptions: SessionOptions = {
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    sameSite: "strict",
  },
};

app.use(session(sessionOptions));
// Passport init
app.use(passport.initialize());
app.use(passport.session());

app.use("/api/users", userRoute);
app.use("/api/sellers", sellerRoutes);
app.use("/api/products", productRoute);
app.use("/api/categories", categoryRoutes);
app.use("/api/carts", cartRoutes);
app.use("/api/cart-items", cartItemRoutes);
app.use("/api/orders", ordersRoute);
app.use("/api/order-items", orderItemRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);
//authroute
app.use("/api/v1/auth", authRoutes);

// Add version prefix v1 will implement in the future (Microservice)
app.use("/api/v1/users", userRoute);
app.use("/api/v1/sellers", sellerRoutes);
app.use("/api/v1/products", productRoute);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/carts", cartRoutes);
app.use("/api/v1/cart-items", cartItemRoutes);
app.use("/api/v1/orders", ordersRoute);
app.use("/api/v1/order-items", orderItemRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/checkout", checkout);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use(errorHandler);

export default app;
