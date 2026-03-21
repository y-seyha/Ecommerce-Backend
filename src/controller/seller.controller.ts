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

  getProductsBySellerId = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const sellerId = req.params.id;

      const query = `
        SELECT p.*, u.first_name AS seller_first_name, u.last_name AS seller_last_name, u.email AS seller_email
        FROM products p
        JOIN users u ON p.user_id = u.id
        WHERE u.id = $1
        ORDER BY p.created_at DESC
      `;

      const { rows } = await this.pool.query(query, [sellerId]);

      if (!rows.length)
        return res
          .status(404)
          .json({ message: "No products found for this seller" });

      res.json(rows);
    } catch (error) {
      this.logger.error(
        `SellerController: getProductsBySellerId failed for sellerId=${req.params.id}`,
        error,
      );
      next(error);
    }
  };

  // get order for seller
  getOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as IUser;
      const orders = await this.service.getOrderBySeller(user.id);
      res.json({ orders });
    } catch (err) {
      next(err);
    }
  };

  // Update status of a seller's order item
  updateOrderItemStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = req.user as IUser;
      const { order_item_id, status } = req.body;

      const updatedItem = await this.service.updateOrderItemStatus(
        order_item_id,
        status,
        user.id,
      );

      res.json({ message: "Order item updated", item: updatedItem });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  };

  // Seller Analytics
  getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as IUser;
      const analytics = await this.service.getAnalytics(user.id);
      res.json(analytics);
    } catch (err) {
      next(err);
    }
  };

  getAllSellers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sellers = await this.service.getAllSellers();
      res.json(sellers);
    } catch (error) {
      this.logger.error("AdminSellerController: getAllSellers failed", error);
      next(error);
    }
  };

  updateSeller = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

     
      const data: Record<string, any> = { ...req.body };

      // If you use multer for file uploads, attach logo file path:
      if (req.file) {
        data.logo_url = req.file.path; // or wherever you save it
      }

      const updated = await this.service.updateSeller(id, data);

      if (!updated)
        return res.status(404).json({ message: "Seller not found" });

      res.json({
        message: "Seller updated successfully",
        data: updated,
      });
    } catch (error: any) {
      this.logger.error("AdminSellerController: updateSeller failed", error);
      res
        .status(500)
        .json({ message: error.message || "Internal server error" });
    }
  };

  deleteSeller = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;

      await this.service.deleteSeller(id);

      res.json({ message: "Seller deleted successfully" });
    } catch (error) {
      this.logger.error("AdminSellerController: deleteSeller failed", error);
      next(error);
    }
  };
}
