import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/dp";
import crypto from "crypto";
import { getAuthActor } from "../utils/helper";

export const RegAdmin = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  console.log("Received data: ", req.body);
  const admin_id = crypto.randomUUID();

  if (!username || !password) {
    res.status(400).json({ message: "Username and password are required" });
    return;
  }
  const hashedPass = await bcrypt.hash(password, 10);
  try {
    const query =
      "INSERT INTO admins (admin_id, username, password) VALUES ($1, $2, $3) RETURNING *;";
    const values = [admin_id, username, hashedPass];
    const result = await pool.query(query, values);
    if ((result.rowCount ?? 0) === 0) {
      res.status(500).json({ message: "Failed to register admin" });
      return;
    }
    console.log("Admin registered successfully");
    const admin = {
      username: result.rows[0].username,
      admin_id: result.rows[0].admin_id,
    };
    const token = jwt.sign(
      { admin_id: admin.admin_id, username: admin.username },
      process.env.JWT_SECRET as string,
      { expiresIn: "1y" }
    );
    res.status(201).json({
      message: "Admin registered successfully",
      admin,
      token,
    });
    // test 1
  } catch (error) {
    console.error("Admin registration error:", (error as Error).message);
    res.status(500).json({ message: "Failed to register admin" });
  }
};

export const LoginAdmin = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ message: "Username and password are required" });
    return;
  }

  try {
    const query = "SELECT * FROM admins WHERE username = $1;";
    const values = [username];
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const admin = result.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign(
      { admin_id: admin.admin_id, username: admin.username },
      process.env.JWT_SECRET as string,
      { expiresIn: "1y" }
    );

    res.status(200).json({
      message: "Login successful",
      admin: {
        username: admin.username,
        admin_id: admin.admin_id,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const changeAdminPassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const { adminId } = getAuthActor(req);

  if (!adminId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    !currentPassword ||
    newPassword.length < 6
  ) {
    res.status(400).json({
      message: "Current password is required and the new password must be at least 6 characters.",
    });
    return;
  }

  try {
    const result = await pool.query("SELECT password FROM admins WHERE admin_id = $1", [
      adminId,
    ]);
    if (result.rowCount === 0) {
      res.status(404).json({ message: "Admin not found" });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!isMatch) {
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    const hashedPass = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE admins SET password = $1 WHERE admin_id = $2", [
      hashedPass,
      adminId,
    ]);

    res.status(200).json({ message: "Password updated" });
  } catch (error) {
    console.error("Change admin password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
