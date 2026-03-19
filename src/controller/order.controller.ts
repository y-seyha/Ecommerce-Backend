import { CreateOrderDTO, UpdateOrderDTO } from "dto/orders.dto.js";
import { NextFunction, Request, Response } from "express";
import { error } from "node:console";
import { OrderService } from "service/orders.service.js";
import { Logger } from "utils/logger.js";
import { paginationSchema } from "valildators/pagination.validator.js";
export class OrderController {
  private service = new OrderService();
  private logger = Logger.getInstance();

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.body as CreateOrderDTO;

      if (!dto.items || !dto.items.length) {
        return res
          .status(400)
          .json({ message: "Order must include at least one item" });
      }

      const result = await this.service.createOrder(dto);
      res.status(201).json(result);
    } catch (error) {
      this.logger.error("Order Controller: Create Failed", error);
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = +req.params.id;
      const dto = req.body as UpdateOrderDTO;
      const order = await this.service.updateOrder(id, dto);
      res.json(order);
    } catch (error) {
      this.logger.error("Order Controller: Update Failed", error);
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = +req.params.id;
      const success = await this.service.deleteOrder(id);
      if (success) {
        res.json({ message: "Deleted Successfully" });
      } else {
        res.status(404).json({ message: "Order not found" });
      }
    } catch (error) {
      this.logger.error("Order Controller: Update Failed", error);
      next(error);
    }
  };

  findAll = async (_: Request, res: Response, next: NextFunction) => {
    try {
      const orders = await this.service.getAllOrders();
      res.json(orders);
    } catch (error) {
      this.logger.error("Order Controller: FindAll Failed", error);
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = +req.params.id;
      const order = await this.service.getOrderById(id);
      order
        ? res.json(order)
        : res.status(404).json({ message: "Order not found" });
    } catch (error) {
      this.logger.error("Order Controller: FindById Failed", error);
      next(error);
    }
  };

  getPaginated = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize } = paginationSchema.parse({
        query: req.query,
      }).query;

      const result = await this.service.getOrderPaginated(page, pageSize);
      res.json(result);
    } catch (error) {
      this.logger.error("Order Controller: GetPaginated Failed", error);
      next(error);
    }
  };
}
