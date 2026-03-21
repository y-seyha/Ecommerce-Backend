import { ProductRepository } from "repository/product.repository.js";
import { CreateProductDto, UpdateProductDto } from "../dto/product.dto.js";
import { Logger } from "utils/logger.js";
import { Database } from "Configuration/database.js";
import redisClient from "Configuration/redis.js";
import { IUser } from "model/user.model.js";

export class ProductService {
  private repo = new ProductRepository();
  private logger = Logger.getInstance();
  private pool = Database.getInstance();

  // ------------------ CREATE ------------------
  async createProduct(dto: CreateProductDto) {
    try {
      if (dto.category_id) {
        const { rows } = await this.pool.query(
          `SELECT id FROM categories WHERE id=$1`,
          [dto.category_id],
        );

        if (!rows.length) {
          throw new Error("Category does not exist");
        }
      }

      dto.stock = dto.stock ?? 0;

      const product = await this.repo.create(dto);

      // ✅ Cache single product
      try {
        await redisClient.setEx(
          `product:${product.id}`,
          24 * 60 * 60,
          JSON.stringify(product),
        );
      } catch (err) {
        this.logger.warn("Redis Error on createProduct", err);
      }

      // 🔥 CLEAR PAGINATED CACHE
      try {
        const keys = await redisClient.keys("products:*");
        if (keys.length) await redisClient.del(keys);
      } catch (err) {
        this.logger.warn("Redis Error clearing cache (create)", err);
      }

      return product;
    } catch (error) {
      this.logger.error("Product Service: Create Failed", error);
      throw error;
    }
  }

  // ------------------ UPDATE ------------------
  async updateProduct(id: number, dto: UpdateProductDto, user: IUser) {
    try {
      const existing = await this.repo.findById(id);

      if (!existing) {
        throw new Error("Product not found");
      }

      // ✅ Authorization
      if (
        existing.user_id &&
        existing.user_id !== user.id &&
        user.role !== "admin"
      ) {
        throw new Error("Unauthorized to update this product");
      }

      // ✅ Validate category
      if (dto.category_id) {
        const { rows } = await this.pool.query(
          `SELECT id FROM categories WHERE id=$1`,
          [dto.category_id],
        );

        if (!rows.length) {
          throw new Error("Category does not exist");
        }
      }

      const updatedProduct = {
        ...existing,
        ...dto,
      };

      const updated = await this.repo.update(id, updatedProduct);

      // ✅ Update single product cache
      try {
        await redisClient.setEx(
          `product:${id}`,
          24 * 60 * 60,
          JSON.stringify(updated),
        );
      } catch (err) {
        this.logger.warn("Redis Error on updateProduct", err);
      }

      // 🔥 CLEAR PAGINATED CACHE
      try {
        const keys = await redisClient.keys("products:*");
        if (keys.length) await redisClient.del(keys);
      } catch (err) {
        this.logger.warn("Redis Error clearing cache (update)", err);
      }

      return updated;
    } catch (error) {
      this.logger.error("Product Service: Update Failed", error);
      throw error;
    }
  }

  // ------------------ DELETE ------------------
  async deleteProduct(id: number, user: IUser) {
    try {
      const existing = await this.repo.findById(id);

      if (!existing) {
        throw new Error("Product not found");
      }

      // ✅ Authorization
      if (
        existing.user_id &&
        existing.user_id !== user.id &&
        user.role !== "admin"
      ) {
        throw new Error("Unauthorized to delete this product");
      }

      await this.repo.delete(id);

      try {
        // delete single product cache
        await redisClient.del(`product:${id}`);

        // 🔥 CLEAR PAGINATED CACHE
        const keys = await redisClient.keys("products:*");
        if (keys.length) await redisClient.del(keys);
      } catch (err) {
        this.logger.warn("Redis Error on deleteProduct", err);
      }

      return true;
    } catch (error) {
      this.logger.error("Product Service: Delete Failed", error);
      throw error;
    }
  }

  // ------------------ GET ALL ------------------
  async getAllProducts() {
    return await this.repo.findAll();
  }

  // ------------------ GET BY ID ------------------
  async getProductById(id: number) {
    const cacheKey = `product:${id}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const product = await this.repo.findById(id);
      if (!product) throw new Error("Product not found");

      await redisClient.setEx(cacheKey, 24 * 60 * 60, JSON.stringify(product));

      return product;
    } catch (error) {
      this.logger.warn("Redis Error in getProductById", error);

      const product = await this.repo.findById(id);
      if (!product) throw new Error("Product not found");

      return product;
    }
  }

  // ------------------ PAGINATED ------------------
  async getProductsPaginated(
    page: number,
    pageSize: number,
    filters?: { categoryId?: number; minPrice?: number; maxPrice?: number },
    sort?: { sortBy?: string; sortOrder?: "ASC" | "DESC" },
    search?: string,
  ) {
    try {
      const cacheKey = `products:page:${page}:size:${pageSize}:filters:${JSON.stringify(filters)}:sort:${JSON.stringify(sort)}:search:${search || ""}`;

      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const result = await this.repo.findAllPaginated(
        page,
        pageSize,
        filters,
        sort,
        search,
      );

      await redisClient.setEx(
        cacheKey,
        10 * 60, // 10 min
        JSON.stringify(result),
      );

      return result;
    } catch (error) {
      this.logger.error("Product Service: GetPaginated Failed", error);
      throw error;
    }
  }
}
