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

  async findById(id: number): Promise<Product> {
    const { rows } = await this.pool.query(
      `SELECT * FROM products WHERE id=$1`,
      [id],
    );
    return rows[0];
  }

  async delete(id: number): Promise<void> {
    await this.pool.query(`DELETE FROM products WHERE id=$1`, [id]);
  }

  async findAllPaginated(
    page: number,
    pageSize: number,
    filters?: { categoryId?: number; minPrice?: number; maxPrice?: number },
    sort?: { sortBy?: string; sortOrder?: "ASC" | "DESC" },
  ) {
    const offset = (page - 1) * pageSize;
    const values: any[] = [];
    const filterClauses: string[] = [];

    // Filtering
    if (filters?.categoryId) {
      values.push(filters.categoryId);
      filterClauses.push(`category_id = $${values.length}`);
    }
    if (filters?.minPrice) {
      values.push(filters.minPrice);
      filterClauses.push(`price >= $${values.length}`);
    }
    if (filters?.maxPrice) {
      values.push(filters.maxPrice);
      filterClauses.push(`price <= $${values.length}`);
    }

    const whereClause = filterClauses.length
      ? `WHERE ${filterClauses.join(" AND ")}`
      : "";

    // Sorting
    const allowedSortFields = ["id", "price", "name", "created_at"];
    const sortField =
      sort?.sortBy && allowedSortFields.includes(sort.sortBy)
        ? sort.sortBy
        : "id";
    const sortOrder = sort?.sortOrder || "ASC";

    // Add LIMIT & OFFSET
    values.push(pageSize, offset);
    const query = `
    SELECT * FROM products
    ${whereClause}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT $${values.length - 1} OFFSET $${values.length}
  `;
    const { rows: data } = await this.pool.query(query, values);

    // Count total
    const countQuery = `SELECT COUNT(*) FROM products ${whereClause}`;
    const { rows } = await this.pool.query(
      countQuery,
      values.slice(0, values.length - 2),
    );
    const total = parseInt(rows[0].count, 10);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
