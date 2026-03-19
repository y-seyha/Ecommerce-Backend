import { Request, Response, NextFunction } from "express";
import { ProductService } from "service/product.service.js";
import { CreateProductDto, UpdateProductDto } from "dto/product.dto.js";
import { Logger } from "utils/logger.js";
import { paginationSchema } from "valildators/pagination.validator.js";
import { Database } from "Configuration/database.js";
import { IUser } from "model/user.model.js";

export class ProductController {
  private service = new ProductService();
  private logger = Logger.getInstance();
  private pool = Database.getInstance();

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: "No file uploaded" });

      const user = req.user as IUser; 

      const dto: CreateProductDto = {
        name: req.body.name,
        description: req.body.description || "",
        price: Number(req.body.price) || 0,
        stock: Number(req.body.stock) || 0,
        category_id: Number(req.body.category_id) || 0,
        image_url: (req.file as any).path,
        image_public_id: (req.file as any).filename,
        user_id: user.id, // <-- assign ownership
      };

      if (!dto.name)
        return res.status(400).json({ message: "Product name is required" });

      const product = await this.service.createProduct(dto);
      res.status(201).json(product);
    } catch (error) {
      this.logger.error("Product Controller: Create with Image Failed", error);
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = +req.params.id;
      const user = req.user as IUser;
      const dto = { ...req.body } as UpdateProductDto;

      if (req.file) {
        dto.image_url = (req.file as any).path;
        dto.image_public_id = (req.file as any).filename;
      }

      const product = await this.service.updateProduct(id, dto, user);
      res.json(product);
    } catch (error) {
      this.logger.error("Product Controller : Update Failed", error);
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = +req.params.id;
      const user = req.user as IUser;

      await this.service.deleteProduct(id, user);
      res.json({ message: "Deleted Successfully" });
    } catch (error) {
      this.logger.error("Product Controller: Delete Failed", error);
      next(error);
    }
  };

  findAll = async (_: Request, res: Response, next: NextFunction) => {
    try {
      const products = await this.service.getAllProducts();

      res.json(products);
    } catch (error) {
      this.logger.error("Product Controller: FindAll Failed", error);
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = +req.params.id;
      const product = await this.service.getProductById(id);

      res.json(product);
    } catch (error) {
      this.logger.error("Product Controller: FindById Failed", error);
      next(error);
    }
  };

  getPaginated = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse page & pageSize using Zod
      const { page, pageSize } = paginationSchema.parse({
        query: req.query,
      }).query;

      // Extract optional filtering & sorting parameters from query
      const { categoryId, minPrice, maxPrice, sortBy, sortOrder } = req.query;

      const result = await this.service.getProductsPaginated(
        Number(page),
        Number(pageSize),
        {
          categoryId: categoryId ? Number(categoryId) : undefined,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
        },
        {
          sortBy: sortBy as string,
          sortOrder: (sortOrder as "ASC" | "DESC") || "ASC",
        },
      );

      res.json(result);
    } catch (error) {
      this.logger.error("Product Controller: GetPaginated Failed", error);
      next(error);
    }
  };

  uploadImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      res.json({
        imageUrl: req.file.path,
        publicId: req.file.filename,
      });
    } catch (error) {
      this.logger.error("Product Controller : Upload Image Failed", error);
      next(error);
    }
  };

  search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = (req.query.search as string) || "";
      const query = `
      SELECT id, name, description, price, stock, category_id, image_url
      FROM products
      WHERE name ILIKE $1
      ORDER BY created_at DESC
      LIMIT 20
    `;
      const result = await this.pool.query(query, [`%${search}%`]);
      res.json({ products: result.rows });
    } catch (err) {
      console.error(err);
      next(err);
    }
  };

  getByCategoryId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categoryId = Number(req.params.id);

      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const query = `
        SELECT id, name, description, price, stock, category_id, image_url, image_public_id, created_at, updated_at
        FROM products
        WHERE category_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [categoryId]);

      res.status(200).json({ products: result.rows });
    } catch (error) {
      this.logger.error(`Product Controller: GetByCategoryId Failed`, error);
      next(error);
    }
  };
}
