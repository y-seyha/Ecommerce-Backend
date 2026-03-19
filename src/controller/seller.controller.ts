import { Request, Response, NextFunction } from "express";
import { IUser } from "../model/user.model.js";
import { SellerService } from "../service/seller.service.js";
import { Logger } from "../utils/logger.js";
import { Database } from "Configuration/database.js";

export class SellerController {
  private pool = Database.getInstance();
  private service = new SellerService();
  private logger = Logger.getInstance();

  getMyStore = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as IUser;
      if (!user || !user.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const seller = await this.service.getMyStore(user.id);
      if (!seller) return res.status(404).json({ message: "Seller not found" });

      res.json(seller);
    } catch (error) {
      this.logger.error("SellerController: getMyStore failed", error);
      next(error);
    }
  };

  updateMyStore = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as IUser;
      if (!user?.id) return res.status(401).json({ message: "Unauthorized" });

      const data = req.body; // only include fields allowed to update
      const updatedSeller = await this.service.updateMyStore(user.id, data);

      if (!updatedSeller)
        return res.status(404).json({ message: "Seller not found" });

      res.json(updatedSeller);
    } catch (error) {
      this.logger.error("SellerController: updateMyStore failed", error);
      next(error);
    }
  };

  getSellerById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sellerId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const seller = await this.service.getSellerById(sellerId);

      if (!seller) return res.status(404).json({ message: "Seller not found" });

      res.json(seller);
    } catch (error) {
      this.logger.error("SellerController: getSellerById failed", error);
      next(error);
    }
  };

  becomeSeller = async (req: Request, res: Response) => {
    const user = req.user as IUser;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { store_name, store_description, store_address, phone, logo_url } =
      req.body;

    if (!store_name)
      return res.status(400).json({ message: "Store name is required" });

    try {
      // Check if user is already a seller
      const existingSeller = await this.pool.query(
        `SELECT * FROM sellers WHERE user_id = $1`,
        [user.id],
      );
      if (existingSeller.rows.length > 0)
        return res
          .status(400)
          .json({ message: "You are already registered as a seller" });

      // Start transaction
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");

        // Update user role
        await client.query(
          `UPDATE users SET role = 'seller', updated_at = NOW() WHERE id = $1`,
          [user.id],
        );

        // Insert seller info
        const sellerResult = await client.query(
          `INSERT INTO sellers
        (user_id, store_name, store_description, store_address, phone, logo_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
          [
            user.id,
            store_name,
            store_description,
            store_address,
            phone,
            logo_url,
          ],
        );

        // Fetch updated user info from users table
        const userResult = await client.query(
          `SELECT id, email, first_name, last_name, role, phone, avatar_url, is_verified, created_at, updated_at
         FROM users
         WHERE id = $1`,
          [user.id],
        );

        await client.query("COMMIT");

        res.status(201).json({
          message: "You are now a seller!",
          user: userResult.rows[0],
          seller: sellerResult.rows[0],
        });
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        res.status(500).json({ message: "Failed to become a seller" });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  };
}
