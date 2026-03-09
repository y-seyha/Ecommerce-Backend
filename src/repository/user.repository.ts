import { Pool } from "pg";
import { Database } from "Configuration/database.js";
import { IAccount, IUser } from "model/user.model.js";

export class UserRepository {
  private db: Pool;

  constructor() {
    this.db = Database.getInstance();
  }

  async create(user: Omit<IUser, "id">): Promise<IUser> {
    const result = await this.db.query(
      `INSERT INTO users(
      first_name,
      last_name,
      email,
      password,
      role,
      is_verified,
      phone
   ) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        user.first_name,
        user.last_name,
        user.email,
        user.password || "",
        user.role || "customer",
        user.is_verified || false,
        user.phone || null,
      ],
    );

    const newUser: IUser = result.rows[0];
    return newUser;
  }

  async findAll(): Promise<IUser[]> {
    const res = await this.db.query(`SELECT * FROM users`);
    return res.rows;
  }

  async findById(id: number): Promise<IUser> {
    const res = await this.db.query(
      `SELECT * FROM users
        WHERE id=$1`,
      [id],
    );
    return res.rows[0];
  }

  async findByEmail(email: string): Promise<IUser> {
    const res = await this.db.query(
      `SELECT * FROM users
        WHERE email=$1`,
      [email],
    );
    return res.rows[0];
  }

  // async update(id: number, user: IUser): Promise<IUser> {
  //   const result = await this.db.query(
  //     `UPDATE users
  //    SET
  //      first_name = $1,
  //      last_name = $2,
  //      email = $3,
  //      password = $4,
  //      role = $5,
  //      provider = $6,
  //      google_id = $7,
  //      is_verified = $8,
  //       phone = $9,
  //      updated_at = NOW()
  //    WHERE id = $10
  //    RETURNING *`,
  //     [
  //       user.first_name,
  //       user.last_name,
  //       user.email,
  //       user.password || null,
  //       user.role || "customer",
  //       user.is_verified || false,
  //       user.phone || null,
  //       id,
  //     ],
  //   );

  //   return result.rows[0];
  // }

  async update(id: number, user: Partial<IUser>): Promise<IUser> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const [key, value] of Object.entries(user)) {
      if (value !== undefined) {
        // only include provided fields
        fields.push(`${key} = $${i}`);
        values.push(value);
        i++;
      }
    }

    if (fields.length === 0) {
      throw new Error("No fields provided for update");
    }

    values.push(id); // last param is id
    const result = await this.db.query(
      `UPDATE users SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      values,
    );

    return result.rows[0];
  }

  async delete(id: number) {
    await this.db.query(`DELETE FROM users WHERE id=$1`, [id]);
  }

  async findAllPaginated(page: number = 1, pageSize: number = 5) {
    const offset = (page - 1) * pageSize;

    const totalResult = await this.db.query(`SELECT COUNT(*) FROM users`);
    const total = Number(totalResult.rows[0]);

    const result = await this.db.query(
      `SELECT id, first_name, last_name, email, role, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );

    return {
      data: result.rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async createOrUpdateAccount(account: IAccount) {
    const existing = await this.db.query(
      `SELECT * FROM accounts
       WHERE provider=$1 AND provider_account_id=$2`,
      [account.provider, account.provider_account_id],
    );

    if (existing.rows.length > 0) {
      // Update tokens if they exist
      return this.db.query(
        `UPDATE accounts
         SET access_token=$1, refresh_token=$2, expires_at=$3
         WHERE id=$4
         RETURNING *`,
        [
          account.access_token || null,
          account.refresh_token || null,
          account.expires_at || null,
          existing.rows[0].id,
        ],
      );
    } else {
      // Create new OAuth account
      return this.db.query(
        `INSERT INTO accounts(
          user_id, provider, provider_account_id, access_token, refresh_token, expires_at
        ) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          account.userId,
          account.provider,
          account.provider_account_id,
          account.access_token ?? null,
          account.refresh_token ?? null,
          account.expires_at ?? null,
        ],
      );
    }
  }
}
