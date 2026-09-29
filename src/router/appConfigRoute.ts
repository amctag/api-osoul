import express from "express";
import {
  getAppVersion,
  getAppVersionSettings,
  sendAnnouncement,
  listAnnouncements,
  updateAppVersionSettings,
} from "../controller/appConfig";

export const publicAppConfigRouter = express.Router();
export const protectedAppConfigRouter = express.Router();

publicAppConfigRouter.get("/app-version", getAppVersion);

protectedAppConfigRouter.get("/app-version-settings", getAppVersionSettings);
protectedAppConfigRouter.put("/app-version-settings", updateAppVersionSettings);
protectedAppConfigRouter.post("/send-announcement", sendAnnouncement);
protectedAppConfigRouter.get("/announcements", listAnnouncements);
