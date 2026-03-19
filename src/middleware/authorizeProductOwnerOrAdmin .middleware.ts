import { Request, Response, NextFunction } from "express";
import { Database } from "../Configuration/database.js";
import { Logger } from "../utils/logger.js";

const logger = Logger.getInstance();
const pool = Database.getInstance();

// Check if current user is admin or owner of the product
export const authorizeProductOwnerOrAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: No user info" });
    }

    const user = req.user as { id: string; role: string };
    const productId = +req.params.id;

    if (user.role === "admin") return next();

    const { rows } = await pool.query(
      "SELECT user_id FROM products WHERE id=$1",
      [productId],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (rows[0].user_id === user.id) return next();

    return res.status(403).json({
      message: "Forbidden: You can only modify your own products",
    });
  } catch (err: any) {
    logger.error(`authorizeProductOwnerOrAdmin failed: ${err.message}`);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
