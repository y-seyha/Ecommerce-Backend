import { Pool } from "pg";
import { Database } from "Configuration/database.js";

export class AuthRepository {
  private db: Pool;

  constructor() {
    this.db = Database.getInstance();
  }

  async findUserByEmail(email: string) {
    const result = await this.db.query(`SELECT * FROM users WHERE email = $1`, [
      email,
    ]);
    return result.rows[0];
  }

  async findUserById(id: number) {
    const result = await this.db.query(`SELECT * FROM users WHERE id = $1`, [
      id,
    ]);
    return result.rows[0];
  }

  async createUser(user: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  }) {
    const result = await this.db.query(
      `INSERT INTO users(first_name,last_name,email,password)
       VALUES($1,$2,$3,$4)
       RETURNING *`,
      [user.first_name, user.last_name, user.email, user.password],
    );

    return result.rows[0];
  }

  async createAccount(account: {
    userId: number;
    provider: string;
    providerAccountId: string;
    accessToken?: string;
    refreshToken?: string;
  }) {
    const result = await this.db.query(
      `INSERT INTO accounts(user_id,provider,provider_account_id,access_token,refresh_token)
       VALUES($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        account.userId,
        account.provider,
        account.providerAccountId,
        account.accessToken,
        account.refreshToken,
      ],
    );

    return result.rows[0];
  }

  async findAccount(provider: string, providerAccountId: string) {
    const result = await this.db.query(
      `SELECT * FROM accounts
       WHERE provider=$1 AND provider_account_id=$2`,
      [provider, providerAccountId],
    );

    return result.rows[0];
  }
}
