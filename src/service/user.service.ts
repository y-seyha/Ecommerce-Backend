import { UserRepository } from "repository/user.repository.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Logger } from "../utils/logger.js";
import { CreateUserDTO, LoginUserDTO, UpdateUserDTO } from "dto/user.dto.js";
import { IUser } from "model/user.model.js";
import { mapUpdateUserDTOToIUser } from "utils/userMapper.js";

const logger = Logger.getInstance();

export class UserService {
  private userRepo = new UserRepository();

  async register(userData: CreateUserDTO) {
    const existingUser = await this.userRepo.findByEmail(userData.email);
    if (existingUser) {
      logger.warn(`Register failed, Email already existed ${userData.email}`);
      throw new Error("Email already existed");
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const newUser = await this.userRepo.create({
      ...userData,
      password: hashedPassword,
      role: userData.role || "customer",
    });

    logger.info(`New user registered successfully: ${newUser.email}`);

    const { password, ...safeUser } = newUser;
    return safeUser;
  }

  async login(data: LoginUserDTO) {
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) {
      logger.warn(`Login failed : User not found -${data.email}`);
      throw new Error("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(data.password, user.password || "");
    if (!isMatch) {
      logger.warn(`Login failed: Wrong password - ${data.email}`);
      throw new Error("Invalid credentials");
    }

    logger.info(`User logged in: ${user.email}`);

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" },
    );

    //Remove password
    const { password, ...safeUser } = user;
    return { user: safeUser, token };
  }

  async updateUser(id: number, dto: UpdateUserDTO) {
    const existingUser = await this.userRepo.findById(id);
    if (!existingUser) {
      logger.warn(`Update failed: User not found - ${id}`);
      throw new Error("User not found");
    }

    // Hash password if provided
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    // Map DTO to full IUser
    const userToUpdate = mapUpdateUserDTOToIUser(existingUser, dto);

    const updatedUser = await this.userRepo.update(id, userToUpdate);

    // Remove password before returning
    const { password, ...safeUser } = updatedUser;
    return safeUser;
  }

  async deleteUser(id: number) {
    const existingUser = await this.userRepo.findById(id);
    if (!existingUser) {
      logger.warn(`Delete failed: User not found - ${id}`);
      throw new Error("User not found");
    }

    await this.userRepo.delete(id);
    logger.info(`User deleted: ${id}`);

    return { message: "User deleted successfully" };
  }

  async getUsers() {
    const users = await this.userRepo.findAll();
    // Remove passwords
    return users.map(({ password, ...rest }) => rest);
  }

  async getUserById(id: number) {
    const user = await this.userRepo.findById(id);
    if (!user) {
      logger.warn(`User not found with id: ${id}`);
      throw new Error("User not found");
    }
    const { password, ...safeUser } = user;
    return safeUser;
  }

  async getUsersPaginated(page: number = 1, pageSize: number = 5) {
    const result = await this.userRepo.findAllPaginated(page, pageSize);

    // remove passwords
    result.data = result.data.map(({ password, ...rest }) => rest);
    return result;
  }

  async findOrCreateSocialUser(profile: {
    email: string;
    name: string;
    provider: "google" | "facebook" | "github";
    providerAccountId: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  }) {
    let user = await this.userRepo.findByEmail(profile.email);

    const [first_name, last_name] = profile.name.split(" ");

    if (!user) {
      // Create new user without password
      user = await this.userRepo.create({
        email: profile.email,
        first_name: first_name || profile.name,
        last_name: last_name || "",
        role: "customer",
        is_verified: true,
        password: undefined,
      });
    }

    // Create or update OAuth account in accounts table
    await this.userRepo.createOrUpdateAccount({
      userId: user.id!,
      provider: profile.provider,
      provider_account_id: profile.providerAccountId,
      access_token: profile.accessToken ?? null,
      refresh_token: profile.refreshToken ?? null,
      expires_at: profile.expiresAt ?? null,
    });
    return user;
  }
}
