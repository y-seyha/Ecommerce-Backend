import { Database } from "../Configuration/database.js";
import { IUser, UserRole } from "../model/user.model.js";

export class UserService {
  private pool = Database.getInstance();

  // ✅ GET ALL USERS (with seller join)
  async getAllUsers() {
    const query = `
    SELECT 
      id,
      email,
      first_name,
      last_name,
      role,
      phone,
      avatar_url,
      is_verified,
      created_at,
      updated_at
    FROM users
    ORDER BY created_at DESC
  `;

    const { rows } = await this.pool.query(query);

    // Map rows directly
    const users = rows.map((row) => ({
      id: row.id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      role: row.role, // just return role
      phone: row.phone,
      avatar_url: row.avatar_url,
      is_verified: row.is_verified,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return users;
  }

  // ✅ GET SINGLE USER
  async getUserById(id: string) {
    const query = `
      SELECT 
        u.*,
        s.id AS seller_id,
        s.store_name,
        s.store_description,
        s.store_address,
        s.phone AS seller_phone,
        s.logo_url
      FROM users u
      LEFT JOIN sellers s ON u.id = s.user_id
      WHERE u.id = $1
    `;

    const { rows } = await this.pool.query(query, [id]);
    return rows[0] || null;
  }

  // ✅ CREATE USER (+ optional seller)
  async createUser(data: {
    email: string;
    first_name?: string;
    last_name?: string;
    role: UserRole;
    phone?: string;
    seller?: any;
  }) {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const userRes = await client.query(
        `
        INSERT INTO users (email, first_name, last_name, role, phone)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
        [data.email, data.first_name, data.last_name, data.role, data.phone],
      );

      const user = userRes.rows[0];

      let seller = null;

      if (data.role === "seller") {
        const sellerRes = await client.query(
          `
          INSERT INTO sellers (user_id, store_name, store_description, store_address, phone, logo_url)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `,
          [
            user.id,
            data.seller?.store_name,
            data.seller?.store_description,
            data.seller?.store_address,
            data.seller?.phone,
            data.seller?.logo_url,
          ],
        );

        seller = sellerRes.rows[0];
      }

      await client.query("COMMIT");

      return { ...user, seller };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // ✅ UPDATE USER (+ handle seller logic)
  async updateUser(id: string, data: any) {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const allowedFields = [
        "first_name",
        "last_name",
        "email",
        "role",
        "phone",
        "is_verified",
      ];

      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          setClauses.push(`${field} = $${idx}`);
          values.push(data[field]);
          idx++;
        }
      }

      if (setClauses.length === 0) {
        // Nothing to update
        return null;
      }

      values.push(id); // For WHERE id=$n
      const query = `
      UPDATE users
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE id = $${idx}
      RETURNING *
    `;

      const userRes = await client.query(query, values);
      const user = userRes.rows[0];

      // 🔥 seller sync
      const sellerCheck = await client.query(
        `SELECT * FROM sellers WHERE user_id=$1`,
        [id],
      );

      const hasSeller = sellerCheck.rows.length > 0;

      if (data.role === "seller") {
        if (!hasSeller) {
          await client.query(
            `INSERT INTO sellers (user_id, store_name) VALUES ($1, $2)`,
            [id, data.seller?.store_name || "New Store"],
          );
        } else {
          await client.query(
            `
          UPDATE sellers
          SET store_name=$1, store_description=$2, store_address=$3, phone=$4, logo_url=$5
          WHERE user_id=$6
        `,
            [
              data.seller?.store_name,
              data.seller?.store_description,
              data.seller?.store_address,
              data.seller?.phone,
              data.seller?.logo_url,
              id,
            ],
          );
        }
      } else if (hasSeller) {
        await client.query(`DELETE FROM sellers WHERE user_id=$1`, [id]);
      }

      await client.query("COMMIT");
      return user;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // ✅ DELETE USER (cascade)
  async deleteUser(id: string) {
    await this.pool.query(`DELETE FROM users WHERE id=$1`, [id]);
    return { message: "User deleted" };
  }
}
