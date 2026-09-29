import express from "express";
import {
  activeUsers,
  deactiveUsers,
  getAllActiveUsers,
  getAllDeActiveUsers,
  isActiveUser,
} from "../controller/adminControl";
import { changeAdminPassword } from "../controller/adminAuth";

// Public routes (is-active is called during auth flow)
export const publicAdminRouter = express.Router();
publicAdminRouter.get("/is-active", isActiveUser);

// Protected routes (auth required - protect middleware applied in index.ts)
export const protectedAdminRouter = express.Router();
protectedAdminRouter.post("/active-users", activeUsers);
protectedAdminRouter.post("/deactive-users", deactiveUsers);
protectedAdminRouter.get("/get-all-active-users", getAllActiveUsers);
protectedAdminRouter.get("/get-all-deactive-users", getAllDeActiveUsers);
protectedAdminRouter.post("/change-admin-password", changeAdminPassword);
