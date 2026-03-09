import { Database } from "Configuration/database.js";
import {
  CreateReviewDTO,
  Review,
  UpdateReviewDTO,
} from "model/review.model.js";

export class ReviewRepository {
  private pool = Database.getInstance();

  async insert(dto: CreateReviewDTO): Promise<Review> {
    const result = await this.pool.query(
      `INSERT INTO reviews (user_id, product_id, rating, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [dto.user_id, dto.product_id, dto.rating, dto.comment || null],
    );
    return result.rows[0];
  }

  async update(id: number, dto: UpdateReviewDTO): Promise<Review | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (dto.rating !== undefined) {
      fields.push(`rating = $${i++}`);
      values.push(dto.rating);
    }
    if (dto.comment) {
      fields.push(`comment = $${i++}`);
      values.push(dto.comment);
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    const query = `
      UPDATE reviews SET ${fields.join(", ")}, created_at = CURRENT_TIMESTAMP
      WHERE id = $${i} RETURNING *`;
    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM reviews WHERE id = $1`, [
      id,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async findById(id: number): Promise<Review | null> {
    const result = await this.pool.query(
      `SELECT * FROM reviews WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  async findAll(): Promise<any[]> {
    const { rows } = await this.pool.query(`
    SELECT
        r.id AS review_id,
        r.rating,
        r.comment,
        r.created_at AS review_created_at,
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        p.id AS product_id,
        p.name AS product_name,
        p.price AS product_price,
        p.stock AS product_stock,
        p.image_url AS product_image
    FROM reviews r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN products p ON r.product_id = p.id
    ORDER BY r.created_at DESC
  `);

    // Transform flat rows into structured review objects
    return rows.map((row) => ({
      id: row.review_id,
      rating: row.rating,
      comment: row.comment,
      created_at: row.review_created_at,
      user: {
        id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
      },
      product: {
        id: row.product_id,
        name: row.product_name,
        price: row.product_price,
        stock: row.product_stock,
        image: row.product_image,
      },
    }));
  }

  async findByProductId(product_id: number): Promise<Review[]> {
    const result = await this.pool.query(
      `SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC`,
      [product_id],
    );
    return result.rows;
  }

  async findByUserId(user_id: number): Promise<Review[]> {
    const result = await this.pool.query(
      `SELECT * FROM reviews WHERE user_id = $1 ORDER BY created_at DESC`,
      [user_id],
    );
    return result.rows;
  }

  async findAllPaginated(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;

    // Total reviews count
    const totalRes = await this.pool.query(`SELECT COUNT(*) FROM reviews`);
    const total = parseInt(totalRes.rows[0].count, 10);

    // Fetch reviews with user and product info
    const dataRes = await this.pool.query(
      `
    SELECT 
      r.id,
      r.rating,
      r.comment,
      r.created_at,
      u.id AS user_id,
      u.first_name AS user_first_name,
      u.last_name AS user_last_name,
      u.email AS user_email,
      p.id AS product_id,
      p.name AS product_name,
      p.price AS product_price,
      p.stock AS product_stock,
      p.image_url AS product_image
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    JOIN products p ON r.product_id = p.id
    ORDER BY r.created_at DESC
    LIMIT $1 OFFSET $2
    `,
      [pageSize, offset],
    );

    // Map rows to a structured format
    const data = dataRes.rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      created_at: row.created_at,
      user: {
        id: row.user_id,
        first_name: row.user_first_name,
        last_name: row.user_last_name,
        email: row.user_email,
      },
      product: {
        id: row.product_id,
        name: row.product_name,
        price: row.product_price,
        stock: row.product_stock,
        image: row.product_image,
      },
    }));

    return {
      data,
      total,
      page,
      pageSize,
    };
  }
}
