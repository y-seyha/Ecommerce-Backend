import { Request, Response } from "express";
import { Database } from "../Configuration/database.js";

const pool = Database.getInstance();

export const updateUserById = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id; // user id from URL
    const { first_name, last_name, email, phone } = req.body;

    // Optional: validate input
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Update user
    const result = await pool.query(
      `UPDATE users
       SET first_name = $1,
           last_name = $2,
           email = $3,
           phone = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, first_name, last_name, email, phone, role, is_verified, avatar_url`,
      [first_name, last_name, email, phone, userId],
    );

    const updatedUser = result.rows[0];

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return updated user
    res.json({ status: "success", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
