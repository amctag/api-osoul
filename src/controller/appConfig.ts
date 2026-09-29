import { Request, Response } from "express";
import { pool } from "../config/dp";
import {
  loadAppVersionSettings,
  saveAppVersionSettings,
  AppVersionSettings,
} from "../utils/appVersionConfig";
import {
  AnnouncementPayload,
  getAllUserPushTokens,
  hasVersionChanged,
  queueAnnouncementNotifications,
  queueVersionUpdateNotifications,
} from "../utils/fcmPushNotifications";

function isValidVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    /^\d+(\.\d+){0,2}$/.test(value.trim())
  );
}

function isValidUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseSettingsBody(body: Request["body"]): AppVersionSettings | null {
  const requiredVersion = body?.required_version;
  const latestVersion = body?.latest_version;
  const forceUpdate = body?.force_update;
  const androidStoreUrl = body?.android_store_url;
  const iosStoreUrl = body?.ios_store_url;

  if (
    !isValidVersion(requiredVersion) ||
    !isValidVersion(latestVersion) ||
    typeof forceUpdate !== "boolean" ||
    !isValidUrl(androidStoreUrl) ||
    !isValidUrl(iosStoreUrl)
  ) {
    return null;
  }

  return {
    required_version: requiredVersion.trim(),
    latest_version: latestVersion.trim(),
    force_update: forceUpdate,
    android_store_url: androidStoreUrl.trim(),
    ios_store_url: iosStoreUrl.trim(),
  };
}

export const getAppVersion = async (_req: Request, res: Response) => {
  try {
    const settings = await loadAppVersionSettings();

    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.status(200).json({
      required_version: settings.required_version,
      latest_version: settings.latest_version,
      force_update: settings.force_update,
      android_store_url: settings.android_store_url,
      ios_store_url: settings.ios_store_url,
    });
  } catch (error) {
    console.error("Error loading app version:", error);
    res.status(500).json({ message: "Failed to load app version settings" });
  }
};

export const getAppVersionSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await loadAppVersionSettings();
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error loading app version settings:", error);
    res.status(500).json({ message: "Failed to load app version settings" });
  }
};

function parseAnnouncementBody(body: Request["body"]): AnnouncementPayload | null {
  const title = body?.title ?? body?.title_ar;
  const message = body?.body ?? body?.body_ar;

  if (
    typeof title !== "string" ||
    typeof message !== "string" ||
    !title.trim() ||
    !message.trim()
  ) {
    return null;
  }

  return {
    title: title.trim(),
    body: message.trim(),
  };
}

async function ensureAnnouncementsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      recipient_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export const listAnnouncements = async (_req: Request, res: Response) => {
  try {
    await ensureAnnouncementsTable();
    const { rows } = await pool.query(
      `SELECT id, title, body, recipient_count, created_at
       FROM announcements
       ORDER BY created_at DESC`
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error loading announcements:", error);
    res.status(500).json({ message: "Failed to load announcements" });
  }
};

export const sendAnnouncement = async (req: Request, res: Response) => {
  const payload = parseAnnouncementBody(req.body);

  if (!payload) {
    res.status(400).json({
      message: "Invalid announcement. Provide non-empty title and body (Arabic).",
    });
    return;
  }

  try {
    const tokens = await getAllUserPushTokens();
    const notifications = {
      queued: tokens.length > 0,
      totalRecipients: tokens.length,
      batchSize: 10,
      totalBatches: Math.ceil(tokens.length / 10) || 0,
    };

    if (tokens.length > 0) {
      queueAnnouncementNotifications(payload);
    }

    await ensureAnnouncementsTable();
    await pool.query(
      `INSERT INTO announcements (title, body, recipient_count) VALUES ($1, $2, $3)`,
      [payload.title, payload.body, tokens.length]
    );

    res.status(200).json({
      message:
        tokens.length > 0
          ? "Announcement is being sent to users in batches"
          : "No users with registered push tokens",
      announcement: payload,
      notifications,
    });
  } catch (error) {
    console.error("Error sending announcement:", error);
    res.status(500).json({ message: "Failed to send announcement" });
  }
};

export const updateAppVersionSettings = async (req: Request, res: Response) => {
  const settings = parseSettingsBody(req.body);

  if (!settings) {
    res.status(400).json({
      message:
        "Invalid settings. Check version format (e.g. 1.2.0) and store URLs (https).",
    });
    return;
  }

  try {
    const previousSettings = await loadAppVersionSettings();
    const saved = await saveAppVersionSettings(settings);
    const versionChanged = hasVersionChanged(previousSettings, saved);

    let notifications = {
      queued: false,
      totalRecipients: 0,
      batchSize: 10,
      totalBatches: 0,
      version: saved.latest_version,
    };

    if (versionChanged) {
      const tokens = await getAllUserPushTokens();
      notifications = {
        queued: tokens.length > 0,
        totalRecipients: tokens.length,
        batchSize: 10,
        totalBatches: Math.ceil(tokens.length / 10),
        version: saved.latest_version,
      };
      queueVersionUpdateNotifications(saved);
    }

    res.status(200).json({
      message: versionChanged
        ? "App version settings updated and update notifications are being sent in batches"
        : "App version settings updated successfully",
      settings: saved,
      notifications,
    });
  } catch (error) {
    console.error("Error saving app version settings:", error);
    res.status(500).json({
      message:
        "Failed to save settings. Ensure app_config table exists in the database.",
    });
  }
};
