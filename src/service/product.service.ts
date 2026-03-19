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

  async createProduct(dto: CreateProductDto) {
    try {
      if (dto.category_id) {
        const { rows } = await this.pool.query(
          `SELECT id FROM categories WHERE id=$1`,
          [dto.category_id],
        );

        if (!rows.length) {
          this.logger.warn(
            `Create Product Failed: Category ${dto.category_id} not found`,
          );

          throw new Error("Category does not exist");
        }
      }

      dto.stock = dto.stock ?? 0;

      const product = await this.repo.create(dto);

      // Redis cache
      try {
        const cacheKey = `product:${product.id}`;
        await redisClient.setEx(
          cacheKey,
          24 * 60 * 60,
          JSON.stringify(product),
        );
      } catch (err) {
        this.logger.warn("Redis Error on createProduct", err);
      }

      return product;
    } catch (error) {
      this.logger.error("Product Service: Create Failed", error);
      throw error;
    }
  }

  async updateProduct(id: number, dto: UpdateProductDto, user: IUser) {
    try {
      const existing = await this.repo.findById(id);
      // Only allow admin or owner to update
      if (
        existing.user_id &&
        existing.user_id !== user.id &&
        user.role !== "admin"
      ) {
        throw new Error("Unauthorized to update this product");
      }

      if (!existing) {
        this.logger.warn(`Update Failed: Product ${id} not found`);
        throw new Error("Product not found");
      }

      if (dto.category_id) {
        const { rows } = await this.pool.query(
          `SELECT id FROM categories WHERE id=$1`,
          [dto.category_id],
        );

        if (!rows.length) {
          this.logger.warn(
            `Update Failed: Category ${dto.category_id} not found`,
          );
          throw new Error("Category does not exist");
        }
      }

      const updatedProduct = {
        ...existing,
        ...dto,
      };

      const updated = await this.repo.update(id, updatedProduct);

      // Update Redis
      try {
        const cacheKey = `product:${id}`;
        await redisClient.setEx(
          cacheKey,
          24 * 60 * 60,
          JSON.stringify(updated),
        );
      } catch (err) {
        this.logger.warn("Redis Error on updateProduct", err);
      }

      return updated;
    } catch (error) {
      this.logger.error("Product Service: Update Failed", error);
      throw error;
    }
  }

  async deleteProduct(id: number, user: IUser) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error("Product not found");

    // Only allow admin or owner to update
    if (
      existing.user_id &&
      existing.user_id !== user.id &&
      user.role !== "admin"
    ) {
      throw new Error("Unauthorized to delete this product");
    }

    await this.repo.delete(id);

    try {
      await redisClient.del(`product:${id}`);
    } catch (err) {
      this.logger.warn("Redis Error on deleteProduct", err);
    }

    return true;
  }

  async getAllProducts() {
    return await this.repo.findAll();
  }

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

  async getProductsPaginated(
    page: number,
    pageSize: number,
    filters?: { categoryId?: number; minPrice?: number; maxPrice?: number },
    sort?: { sortBy?: string; sortOrder?: "ASC" | "DESC" },
  ) {
    try {
      const cacheKey = `products:page:${page}:size:${pageSize}:filters:${JSON.stringify(filters)}:sort:${JSON.stringify(sort)}`;

      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const result = await this.repo.findAllPaginated(
        page,
        pageSize,
        filters,
        sort,
      );

      await redisClient.setEx(
        cacheKey,
        10 * 60, // 10 min cache for paginated list
        JSON.stringify(result),
      );
      return result;
    } catch (error) {
      this.logger.error("Product Service: GetPaginated Failed", error);
      throw error;
    }
  }
}
