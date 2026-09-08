import express from "express";
import {
  getSupport,
  getSupportSettings,
  updateSupportSettings,
} from "../controller/support";

export const publicSupportRouter = express.Router();
export const protectedSupportRouter = express.Router();

publicSupportRouter.get("/support", getSupport);

protectedSupportRouter.get("/support-settings", getSupportSettings);
protectedSupportRouter.put("/support-settings", updateSupportSettings);
