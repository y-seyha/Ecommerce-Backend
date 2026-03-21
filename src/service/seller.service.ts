import { Database } from "../Configuration/database.js";
import { Seller } from "../model/seller.model.js";
import { IUser } from "../model/user.model.js";

export class SellerService {
  private pool = Database.getInstance();

  async getMyStore(
    user_id: string,
  ): Promise<{ user: IUser; seller: Seller } | null> {
    const query = `
      SELECT s.*, u.id as user_id, u.email, u.first_name, u.last_name, u.role, u.phone, u.avatar_url, u.is_verified, u.created_at as user_created_at, u.updated_at as user_updated_at
      FROM sellers s
      JOIN users u ON u.id = s.user_id
      WHERE s.user_id = $1
      LIMIT 1
    `;
    const { rows } = await this.pool.query(query, [user_id]);
    if (!rows[0]) return null;

    const row = rows[0];
    const seller: Seller = {
      id: row.id,
      user_id: row.user_id,
      store_name: row.store_name,
      store_description: row.store_description,
      store_address: row.store_address,
      phone: row.phone,
      logo_url: row.logo_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    const user: IUser = {
      id: row.user_id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      role: row.role,
      phone: row.phone,
      avatar_url: row.avatar_url,
      is_verified: row.is_verified,
      created_at: row.user_created_at,
      updated_at: row.user_updated_at,
    };

    return { seller, user };
  }

  async updateMyStore(
    user_id: string,
    data: Partial<Seller>,
  ): Promise<Seller | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (fields.length === 0)
      return this.getMyStore(user_id).then((res) => res?.seller || null);

    fields.push(`updated_at = NOW()`);
    const query = `
      UPDATE sellers
      SET ${fields.join(", ")}
      WHERE user_id = $${idx}
      RETURNING *
    `;
    values.push(user_id);

    const { rows } = await this.pool.query(query, values);
    return rows[0] || null;
  }

  async getOrderBySeller(user_id: string) {
    const query = `
      SELECT 
        o.id AS order_id,
        o.status AS order_status,
        o.total_price,
        o.shipping_name,
        o.shipping_phone,
        o.shipping_address,
        o.shipping_city,
        oi.id AS order_item_id,
        oi.product_id,
        p.name AS product_name,
        oi.quantity,
        oi.price AS item_price, oi.status AS status,
        o.created_at
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.user_id = $1
      ORDER BY o.created_at DESC
    `;
    const { rows } = await this.pool.query(query, [user_id]);
    return rows;
  }

  // Update order item status for seller's product(s)
  async updateOrderItemStatus(
    order_item_id: number,
    status: string,
    user_id: string,
  ) {
    // Verify the item belongs to this seller
    const check = await this.pool.query(
      `
      SELECT oi.id
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.id = $1 AND p.user_id = $2
    `,
      [order_item_id, user_id],
    );

    if (check.rows.length === 0) throw new Error("Unauthorized");

    // Update status
    const update = await this.pool.query(
      `UPDATE order_items SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, order_item_id],
    );

    return update.rows[0];
  }

  async getAnalytics(user_id: string) {
    const revenueQuery = `
      SELECT 
        COUNT(DISTINCT o.id) AS total_orders,
        SUM(oi.price * oi.quantity) AS total_revenue
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.user_id = $1
    `;
    const topProductsQuery = `
      SELECT p.id, p.name, SUM(oi.quantity) AS total_sold
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE p.user_id = $1
      GROUP BY p.id, p.name
      ORDER BY total_sold DESC
      LIMIT 5
    `;
    const reviewsQuery = `
      SELECT p.id, p.name, AVG(r.rating) AS avg_rating, COUNT(r.id) AS total_reviews
      FROM products p
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.user_id = $1
      GROUP BY p.id, p.name
      ORDER BY avg_rating DESC
    `;

    const revenueRes = await this.pool.query(revenueQuery, [user_id]);
    const topProductsRes = await this.pool.query(topProductsQuery, [user_id]);
    const reviewsRes = await this.pool.query(reviewsQuery, [user_id]);

    return {
      revenue: revenueRes.rows[0],
      topProducts: topProductsRes.rows,
      reviews: reviewsRes.rows,
    };
  }

  async getAllSellers() {
    const query = `
      SELECT 
        s.*,
        u.email,
        u.first_name,
        u.last_name,
        u.role
      FROM sellers s
      JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC
    `;

    const { rows } = await this.pool.query(query);
    return rows;
  }

  async getSellerById(
    seller_id: string,
  ): Promise<{ user: IUser; seller: Seller } | null> {
    const query = `
      SELECT s.*, u.id as user_id, u.email, u.first_name, u.last_name, u.role, u.phone, u.avatar_url, u.is_verified, u.created_at as user_created_at, u.updated_at as user_updated_at
      FROM sellers s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
      LIMIT 1
    `;
    const { rows } = await this.pool.query(query, [seller_id]);
    if (!rows[0]) return null;

    const row = rows[0];
    const seller: Seller = {
      id: row.id,
      user_id: row.user_id,
      store_name: row.store_name,
      store_description: row.store_description,
      store_address: row.store_address,
      phone: row.phone,
      logo_url: row.logo_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    const user: IUser = {
      id: row.user_id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      role: row.role,
      phone: row.phone,
      avatar_url: row.avatar_url,
      is_verified: row.is_verified,
      created_at: row.user_created_at,
      updated_at: row.user_updated_at,
    };

    return { seller, user };
  }

  async updateSeller(id: string, data: any) {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }

    fields.push(`updated_at = NOW()`);

    const query = `
      UPDATE sellers
      SET ${fields.join(", ")}
      WHERE id = $${i}
      RETURNING *
    `;

    values.push(id);

    const { rows } = await this.pool.query(query, values);
    return rows[0];
  }

  // ✅ DELETE SELLER ONLY
  async deleteSeller(id: string) {
    await this.pool.query(`DELETE FROM sellers WHERE id=$1`, [id]);
    return { message: "Seller deleted" };
  }
}
