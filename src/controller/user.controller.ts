import { Request, Response, NextFunction } from "express";
import { UserService } from "service/user.service.js";
import { Logger } from "utils/logger.js";

export class UserController {
  private service = new UserService();
  private logger = Logger.getInstance();

  private getId(param: string | string[] | undefined): string {
    if (!param) throw new Error("Invalid ID");
    return Array.isArray(param) ? param[0] : param;
  }

  getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await this.service.getAllUsers();
      res.json(users);
    } catch (error) {
      this.logger.error("UserController: getAllUsers failed", error);
      next(error);
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.getId(req.params.id);

      const user = await this.service.getUserById(id);
      if (!user) return res.status(404).json({ message: "User not found" });

      res.json(user);
    } catch (error) {
      this.logger.error("UserController: getUserById failed", error);
      next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;

      if (!data.email || !data.role) {
        return res.status(400).json({
          message: "Email and role are required",
        });
      }

      const user = await this.service.createUser(data);

      res.status(201).json({
        message: "User created successfully",
        data: user,
      });
    } catch (error) {
      this.logger.error("UserController: createUser failed", error);
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.getId(req.params.id);
      const data = req.body;

      if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({ message: "No data provided" });
      }

      const updated = await this.service.updateUser(id, data);

      if (!updated) return res.status(404).json({ message: "User not found" });

      res.json({
        message: "User updated successfully",
        data: updated,
      });
    } catch (error) {
      this.logger.error("UserController: updateUser failed", error);
      next(error);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = this.getId(req.params.id);

      await this.service.deleteUser(id);

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      this.logger.error("UserController: deleteUser failed", error);
      next(error);
    }
  };
}
