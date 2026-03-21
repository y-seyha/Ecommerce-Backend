import { Request, Response } from "express";
import { Database } from "../../Configuration/database.js";

export class AdminDashboardController {
  private pool = Database.getInstance();

  getDashboard = async (req: Request, res: Response) => {
    const client = await this.pool.connect();
    try {
      // KPI metrics
      const revenueResult = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS revenue
         FROM payments
         WHERE status = 'paid'`,
      );

      const ordersResult = await client.query(
        `SELECT COUNT(*) AS total_orders FROM orders`,
      );

      const usersResult = await client.query(
        `SELECT COUNT(*) AS total_users FROM users`,
      );

      const paymentsResult = await client.query(
        `SELECT COUNT(*) AS total_payments FROM payments`,
      );

      //  Payment Methods
      const paymentMethodsResult = await client.query(`
        SELECT method, COUNT(*) as count
        FROM payments
        GROUP BY method
      `);

      //  Order Status
      const orderStatusResult = await client.query(
        `SELECT status, COUNT(*) AS count
         FROM orders
         GROUP BY status`,
      );

      //  Recent Orders
      const recentOrdersResult = await client.query(`
        SELECT o.id, u.email, o.total_price, o.status, o.created_at
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
        LIMIT 5
      `);

      //  Revenue & Orders Trend (last 7 days)
      const trendResult = await client.query(`
        SELECT
           DATE_TRUNC('day', o.created_at) AS date,
           COALESCE(SUM(p.amount), 0) AS revenue,
           COUNT(o.id) AS orders
        FROM orders o
        LEFT JOIN payments p ON o.id = p.order_id AND p.status = 'paid'
        WHERE o.created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE_TRUNC('day', o.created_at)
        ORDER BY date ASC
      `);

      //  Insights (top category, peak hour)
      const topCategoryResult = await client.query(`
        SELECT c.name, SUM(oi.quantity * oi.price) AS revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        GROUP BY c.name
        ORDER BY revenue DESC
        LIMIT 1
      `);

      const peakHourResult = await client.query(`
        SELECT EXTRACT(HOUR FROM created_at) AS hour, COUNT(*) AS orders_count
        FROM orders
        GROUP BY hour
        ORDER BY orders_count DESC
        LIMIT 1
      `);

      //  Top Products (by revenue)
      const topProductsResult = await client.query(`
        SELECT p.name, SUM(oi.quantity * oi.price) AS revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT 3
      `);

      //  Activity Feed (recent actions)
      const recentPaymentsResult = await client.query(`
        SELECT id, status, created_at
        FROM payments
        ORDER BY created_at DESC
        LIMIT 3
      `);

      const recentUsersResult = await client.query(`
        SELECT email, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 3
      `);

      // Assemble response
      res.json({
        kpis: {
          revenue: Number(revenueResult.rows[0].revenue),
          orders: Number(ordersResult.rows[0].total_orders),
          users: Number(usersResult.rows[0].total_users),
          payments: Number(paymentsResult.rows[0].total_payments),
        },
        paymentMethods: paymentMethodsResult.rows.map((r: any) => ({
          method: r.method,
          count: Number(r.count),
        })),
        orderStatus: orderStatusResult.rows.map((r: any) => ({
          status: r.status,
          count: Number(r.count),
        })),
        recentOrders: recentOrdersResult.rows,
        trend: trendResult.rows.map((r: any) => ({
          date: r.date,
          revenue: Number(r.revenue),
          orders: Number(r.orders),
        })),
        topProducts: topProductsResult.rows.map((r: any) => ({
          name: r.name,
          revenue: Number(r.revenue),
        })),
        insights: {
          topCategory: topCategoryResult.rows[0]?.name || null,
          peakHour: peakHourResult.rows[0]?.hour || null,
        },
        activityFeed: [
          ...recentOrdersResult.rows.map(
            (o: any) => `Order #${o.id} placed by ${o.email}`,
          ),
          ...recentPaymentsResult.rows.map(
            (p: any) => `Payment #${p.id} ${p.status}`,
          ),
          ...recentUsersResult.rows.map(
            (u: any) => `New user registered: ${u.email}`,
          ),
        ].slice(0, 5), // latest 5 events
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to load dashboard" });
    } finally {
      client.release();
    }
  };
}
