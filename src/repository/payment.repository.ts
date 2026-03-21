import { Database } from "Configuration/database.js";
import { CreatePaymentDTO, UpdatePaymentDTO } from "../dto/payment.dto.js";
import { Payment } from "model/payment.model.js";

export class PaymentRepository {
  private pool = Database.getInstance();

  async insert(dto: CreatePaymentDTO) {
    const { rows } = await this.pool.query(
      `INSERT INTO payments (order_id, amount, method)
     VALUES ($1,$2,$3) RETURNING *`,
      [dto.order_id, dto.amount, dto.method],
    );

    return rows[0];
  }

  async update(id: number, dto: UpdatePaymentDTO): Promise<Payment | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (dto.amount !== undefined) {
      fields.push(`amount = $${i++}`);
      values.push(dto.amount);
    }
    if (dto.method) {
      fields.push(`method = $${i++}`);
      values.push(dto.method);
    }
    if (dto.status) {
      fields.push(`status = $${i++}`);
      values.push(dto.status);
    }
    if (dto.paid_at) {
      fields.push(`paid_at = $${i++}`);
      values.push(dto.paid_at);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const query = `
      UPDATE payments SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${i} RETURNING *`;
    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM payments WHERE id = $1`, [
      id,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async findById(id: number): Promise<Payment | null> {
    const result = await this.pool.query(
      `SELECT * FROM payments WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  async findAll(): Promise<any[]> {
    const { rows } = await this.pool.query(`
    SELECT
        p.id AS payment_id,
        p.amount,
        p.method,
        p.status AS payment_status,
        p.paid_at,
        p.created_at AS payment_created_at,
        p.updated_at AS payment_updated_at,
        o.id AS order_id,
        o.total_price AS order_total_price,
        o.status AS order_status,
        o.created_at AS order_created_at,
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email
    FROM payments p
    LEFT JOIN orders o ON p.order_id = o.id
    LEFT JOIN users u ON o.user_id = u.id
    ORDER BY p.created_at DESC
  `);

    // Transform flat rows into structured payment objects
    return rows.map((row) => ({
      id: row.payment_id,
      amount: row.amount,
      method: row.method,
      status: row.payment_status,
      paid_at: row.paid_at,
      created_at: row.payment_created_at,
      updated_at: row.payment_updated_at,
      order: {
        id: row.order_id,
        total_price: row.order_total_price,
        status: row.order_status,
        created_at: row.order_created_at,
        user: {
          id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
        },
      },
    }));
  }

  async findByOrderId(order_id: number): Promise<Payment[]> {
    const result = await this.pool.query(
      `SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC`,
      [order_id],
    );
    return result.rows;
  }

  async findAllPaginated(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;

    // Total count of payments
    const totalRes = await this.pool.query(`SELECT COUNT(*) FROM payments`);
    const total = parseInt(totalRes.rows[0].count, 10);

    // Fetch paginated payments with order and user info
    const dataRes = await this.pool.query(
      `
    SELECT 
        p.id AS payment_id,
        p.amount AS payment_amount,
        p.method AS payment_method,
        p.status AS payment_status,
        p.paid_at AS payment_paid_at,
        p.created_at AS payment_created_at,
        o.id AS order_id,
        o.total_price AS order_total,
        o.status AS order_status,
        o.created_at AS order_created_at,
        u.id AS user_id,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.email AS user_email
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN users u ON o.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT $1 OFFSET $2
    `,
      [pageSize, offset],
    );

    return {
      data: dataRes.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
