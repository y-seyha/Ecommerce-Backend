import { Database } from "../Configuration/database.js";
import { Product } from "model/product.model.js";
import { Logger } from "utils/logger.js";

export class ProductRepository {
  private logger = Logger.getInstance();
  private pool = Database.getInstance();

  async create(product: Product): Promise<Product> {
    const query = `
    INSERT INTO products(
      user_id,          
      name,
      description,
      price,
      stock,
      category_id,
      image_url,
      image_public_id
    )
    VALUES($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;

    const values = [
      product.user_id,
      product.name,
      product.description,
      product.price,
      product.stock ?? 0,
      product.category_id,
      product.image_url ?? null,
      product.image_public_id ?? null,
    ];

    const { rows } = await this.pool.query(query, values);
    return rows[0];
  }

  async update(id: number, product: Product): Promise<Product> {
    const query = `
    UPDATE products 
    SET name=$1,
        description=$2,
        price=$3,
        stock=$4,
        category_id=$5,
        image_url=$6,        -- <-- add image_url
        updated_at=CURRENT_TIMESTAMP
    WHERE id=$7
    RETURNING *
  `;

    const values = [
      product.name,
      product.description,
      product.price,
      product.stock,
      product.category_id,
      product.image_url ?? null, // <-- include image URL
      id,
    ];

    const { rows } = await this.pool.query(query, values);
    return rows[0];
  }

  async findAll(): Promise<Product[]> {
    const { rows } = await this.pool.query(`SELECT * FROM products`);
    return rows;
  }

  async findById(id: number): Promise<Product | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM products WHERE id=$1`,
      [id],
    );

    return rows[0] || null;
  }

  async delete(id: number): Promise<void> {
    await this.pool.query(`DELETE FROM products WHERE id=$1`, [id]);
  }

  async findAllPaginated(
    page: number,
    pageSize: number,
    filters?: { categoryId?: number; minPrice?: number; maxPrice?: number },
    sort?: { sortBy?: string; sortOrder?: "ASC" | "DESC" },
    search?: string,
  ) {
    const values: any[] = [];
    let index = 1;

    let query = `
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;

    // 🔍 SEARCH
    if (search) {
      query += ` AND p.name ILIKE $${index}`;
      values.push(`%${search}%`);
      index++;
    }

    // 🎯 FILTERS
    if (filters?.categoryId) {
      query += ` AND p.category_id = $${index}`;
      values.push(filters.categoryId);
      index++;
    }

    if (filters?.minPrice) {
      query += ` AND p.price >= $${index}`;
      values.push(filters.minPrice);
      index++;
    }

    if (filters?.maxPrice) {
      query += ` AND p.price <= $${index}`;
      values.push(filters.maxPrice);
      index++;
    }

    // 📊 SORT
    if (sort?.sortBy) {
      query += ` ORDER BY p.${sort.sortBy} ${sort.sortOrder || "ASC"}`;
    } else {
      query += ` ORDER BY p.created_at DESC`;
    }

    // 📄 PAGINATION
    query += ` LIMIT $${index} OFFSET $${index + 1}`;
    values.push(pageSize, (page - 1) * pageSize);

    const { rows } = await this.pool.query(query, values);

    // ✅ COUNT query with same filters
    const countValues: any[] = [];
    let countIndex = 1;
    let countQuery = `SELECT COUNT(*) FROM products p WHERE 1=1`;

    if (search) {
      countQuery += ` AND p.name ILIKE $${countIndex}`;
      countValues.push(`%${search}%`);
      countIndex++;
    }
    if (filters?.categoryId) {
      countQuery += ` AND p.category_id = $${countIndex}`;
      countValues.push(filters.categoryId);
      countIndex++;
    }
    if (filters?.minPrice) {
      countQuery += ` AND p.price >= $${countIndex}`;
      countValues.push(filters.minPrice);
      countIndex++;
    }
    if (filters?.maxPrice) {
      countQuery += ` AND p.price <= $${countIndex}`;
      countValues.push(filters.maxPrice);
      countIndex++;
    }

    const countRes = await this.pool.query(countQuery, countValues);
    const totalItems = Number(countRes.rows[0].count);
    const totalPages = Math.ceil(totalItems / pageSize);

    // adjust page if too high
    const currentPage = page > totalPages ? totalPages : page;

    return {
      data: rows,
      page: currentPage,
      pageSize,
      totalItems,
      totalPages,
    };
  }

  async decreaseStock(productId: number, quantity: number) {
    const { rows } = await this.pool.query(
      `UPDATE products
     SET stock = stock - $1
     WHERE id = $2 AND stock >= $1
     RETURNING *`,
      [quantity, productId],
    );

    return rows[0] || null;
  }
}
