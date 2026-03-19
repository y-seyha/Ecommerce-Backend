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
}
