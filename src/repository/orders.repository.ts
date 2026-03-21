import { Database } from "Configuration/database.js";
import { CreateOrderDTO, UpdateOrderDTO } from "dto/orders.dto.js";
import { Order } from "model/orders.model.js";

export class OrderRepository {
  private pool = Database.getInstance();

  async insert(dto: CreateOrderDTO) {
    const { rows } = await this.pool.query(
      `INSERT INTO orders
      (user_id, total_price, status, shipping_name, shipping_phone, shipping_address, shipping_city)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        dto.user_id,
        dto.total_price,
        dto.status || "pending",
        dto.shipping_name ?? "",
        dto.shipping_phone ?? "",
        dto.shipping_address ?? "",
        dto.shipping_city ?? "",
      ],
    );
    return rows[0];
  }

  async update(id: number, data: UpdateOrderDTO): Promise<Order | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (data.total_price !== undefined) {
      fields.push(`total_price = $${i++}`);
      values.push(data.total_price);
    }

    if (data.status) {
      fields.push(`status = $${i++}`);
      values.push(data.status);
    }
    if (data.shipping_name !== undefined) {
      fields.push(`shipping_name = $${i++}`);
      values.push(data.shipping_name ?? null);
    }

    if (data.shipping_phone !== undefined) {
      fields.push(`shipping_phone = $${i++}`);
      values.push(data.shipping_phone ?? null);
    }

    if (data.shipping_address !== undefined) {
      fields.push(`shipping_address = $${i++}`);
      values.push(data.shipping_address ?? null);
    }

    if (data.shipping_city !== undefined) {
      fields.push(`shipping_city = $${i++}`);
      values.push(data.shipping_city ?? null);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }
    values.push(id);
    const query = `
    UPDATE orders 
    SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP 
    WHERE id = $${i} 
    RETURNING *`;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM orders WHERE id = $1`, [
      id,
    ]);

    // rowCount might be null
    const rowCount = result.rowCount ?? 0;
    return rowCount > 0;
  }

  async findById(id: number): Promise<Order | null> {
    const result = await this.pool.query(`SELECT * FROM orders WHERE id = $1`, [
      id,
    ]);
    return result.rows[0] || null;
  }

  async findAll(): Promise<any[]> {
    const { rows } = await this.pool.query(`
    SELECT
        o.id AS order_id,
        o.total_price,
        o.status AS order_status,
        o.created_at AS order_created_at,
        o.updated_at AS order_updated_at,
        u.id AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        oi.id AS order_item_id,
        oi.quantity AS item_quantity,
        oi.price AS item_price,
        p.id AS product_id,
        p.name AS product_name,
        p.price AS product_price,
        p.stock AS product_stock,
        p.image_url AS product_image
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    ORDER BY o.created_at DESC, oi.id
  `);

    // Transform flat rows into structured orders with nested items
    const ordersMap = new Map<number, any>();

    for (const row of rows) {
      if (!ordersMap.has(row.order_id)) {
        ordersMap.set(row.order_id, {
          id: row.order_id,
          total_price: row.total_price,
          status: row.order_status,
          created_at: row.order_created_at,
          updated_at: row.order_updated_at,
          user: {
            id: row.user_id,
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
          },
          items: [],
        });
      }

      if (row.order_item_id) {
        ordersMap.get(row.order_id).items.push({
          id: row.order_item_id,
          quantity: row.item_quantity,
          price: row.item_price,
          product: {
            id: row.product_id,
            name: row.product_name,
            price: row.product_price,
            stock: row.product_stock,
            image: row.product_image,
          },
        });
      }
    }

    return Array.from(ordersMap.values());
  }

  async findAllPaginated(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;

    // Total count
    const totalRes = await this.pool.query(`SELECT COUNT(*) FROM orders`);
    const total = parseInt(totalRes.rows[0].count, 10);

    // Join orders with users to get full name
    const dataRes = await this.pool.query(
      `SELECT 
       o.*,
       u.first_name || ' ' || u.last_name AS user_full_name
     FROM orders o
     JOIN users u ON o.user_id = u.id
     ORDER BY o.created_at DESC
     LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );

    return { data: dataRes.rows, total, page, pageSize };
  }
}
