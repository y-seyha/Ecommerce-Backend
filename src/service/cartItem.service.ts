import { CartItemRepository } from "repository/cartItem.repository.js";
import { CreateCartItemDto, UpdateCartItemDto } from "../dto/cartItem.dto.js";
import { Logger } from "utils/logger.js";
import { Database } from "Configuration/database.js";
import redisClient from "Configuration/redis.js";

export class UserCartItemService {
  private repo = new CartItemRepository();
  private logger = Logger.getInstance();
  private pool = Database.getInstance();

  // Create item in the user's own cart
  async createCartItem(dto: CreateCartItemDto, userId: number) {
    // Get cart
    let { rows: cartRows } = await this.pool.query(
      `SELECT id FROM carts WHERE user_id=$1`,
      [userId],
    );

    let cartId: number;

    if (cartRows.length) {
      cartId = cartRows[0].id;
    } else {
      // Create cart if not exists
      const { rows: newCartRows } = await this.pool.query(
        `INSERT INTO carts(user_id) VALUES($1) RETURNING id`,
        [userId],
      );
      cartId = newCartRows[0].id;
    }

    // Insert into cart_items
    const { rows: cartItemRows } = await this.pool.query(
      `INSERT INTO cart_items(cart_id, product_id, quantity) 
     VALUES($1, $2, $3) RETURNING *`,
      [cartId, dto.product_id, dto.quantity],
    );

    const cartItem = cartItemRows[0];

    // Update cache
    try {
      const cacheKey = `cartItem:${cartItem.id}`;
      await redisClient.setEx(cacheKey, 24 * 60 * 60, JSON.stringify(cartItem));
      await redisClient.del(`cartItems:cart:${cartId}`);
    } catch (error) {
      this.logger.warn("Redis Error on createCartItem", error);
    }

    return cartItem;
  }
  // Get items of user's cart only
  async getItemsByCartId(cartId: number, userId: number) {
    const { rows: cartRows } = await this.pool.query(
      `SELECT id FROM carts WHERE id=$1 AND user_id=$2`,
      [cartId, userId],
    );
    if (!cartRows.length) {
      this.logger.warn(`User ${userId} tried to access cart ${cartId}`);
      throw new Error("Cart not found or does not belong to user");
    }

    const cacheKey = `cartItems:cart:${cartId}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const items = await this.repo.findByCartId(cartId);

      await redisClient.setEx(cacheKey, 24 * 60 * 60, JSON.stringify(items));
      return items;
    } catch (err) {
      this.logger.error("Redis Error in getItemsByCartId", err);
      return await this.repo.findByCartId(cartId);
    }
  }

  // Update item in user's cart
  async updateCartItem(id: number, dto: UpdateCartItemDto, userId: number) {
    const existing = await this.repo.findById(id);
    if (
      !existing ||
      !(await this.isCartOwnedByUser(existing.cart_id, userId))
    ) {
      throw new Error("CartItem not found or not owned by user");
    }

    const updatedItem = { ...existing, ...dto };
    const result = await this.repo.update(id, updatedItem);

    try {
      await redisClient.del(`cartItems:cart:${result.cart_id}`);
      await redisClient.setEx(
        `cartItem:${id}`,
        24 * 60 * 60,
        JSON.stringify(result),
      );
    } catch (error) {
      this.logger.warn("Redis Error on updateCartItem", error);
    }

    return result;
  }

  // Delete item in user's cart
  async deleteCartItem(id: number, userId: number) {
    const existing = await this.repo.findById(id);
    if (
      !existing ||
      !(await this.isCartOwnedByUser(existing.cart_id, userId))
    ) {
      throw new Error("CartItem not found or not owned by user");
    }

    await this.repo.delete(id);

    try {
      await redisClient.del(`cartItem:${id}`);
      await redisClient.del(`cartItems:cart:${existing.cart_id}`);
    } catch (error) {
      this.logger.warn("Redis Error on deleteCartItem", error);
    }
  }

  // Helper to verify ownership
  private async isCartOwnedByUser(cartId: number, userId: number) {
    const { rows } = await this.pool.query(
      `SELECT id FROM carts WHERE id=$1 AND user_id=$2`,
      [cartId, userId],
    );
    return rows.length > 0;
  }
}

export class AdminCartItemService {
  private repo = new CartItemRepository();
  private logger = Logger.getInstance();

  async createCartItem(dto: CreateCartItemDto) {
    const cartItem = await this.repo.create(dto);

    try {
      const cacheKey = `cartItem:${cartItem.id}`;
      await redisClient.setEx(cacheKey, 24 * 60 * 60, JSON.stringify(cartItem));
      await redisClient.del(`cartItems:cart:${dto.cart_id}`);
    } catch (error) {
      this.logger.warn("Redis Error on createCartItem", error);
    }

    return cartItem;
  }

  async updateCartItem(id: number, dto: UpdateCartItemDto) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error("CartItem not found");

    const updatedItem = { ...existing, ...dto };
    const result = await this.repo.update(id, updatedItem);

    try {
      await redisClient.del(`cartItems:cart:${result.cart_id}`);
      await redisClient.setEx(
        `cartItem:${id}`,
        24 * 60 * 60,
        JSON.stringify(result),
      );
    } catch (error) {
      this.logger.warn("Redis Error on updateCartItem", error);
    }

    return result;
  }

  async deleteCartItem(id: number) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error("CartItem not found");

    await this.repo.delete(id);

    try {
      await redisClient.del(`cartItem:${id}`);
      await redisClient.del(`cartItems:cart:${existing.cart_id}`);
    } catch (error) {
      this.logger.warn("Redis Error on deleteCartItem", error);
    }
  }

  async getAllCartItems() {
    return await this.repo.findAll();
  }

  async getCartItemById(id: number) {
    const cacheKey = `cartItem:${id}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const item = await this.repo.findById(id);
      if (!item) throw new Error("CartItem not found");

      await redisClient.setEx(cacheKey, 24 * 60 * 60, JSON.stringify(item));
      return item;
    } catch (error) {
      this.logger.warn("Redis Error in getCartItemById", error);
      return await this.repo.findById(id);
    }
  }
}
