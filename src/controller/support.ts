import { Request, Response } from "express";
import {
  loadSupportSettings,
  saveSupportSettings,
  SupportSettings,
} from "../utils/supportConfig";

function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function parseSupportBody(body: Request["body"]): SupportSettings | null {
  const email = body?.email;

  if (!isValidEmail(email)) {
    return null;
  }

  return { email: email.trim() };
}

export const getSupport = async (_req: Request, res: Response) => {
  try {
    const settings = await loadSupportSettings();

    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.status(200).json({ email: settings.email });
  } catch (error) {
    console.error("Error loading support email:", error);
    res.status(500).json({ message: "Failed to load support email" });
  }
};

export const getSupportSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await loadSupportSettings();
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error loading support settings:", error);
    res.status(500).json({ message: "Failed to load support settings" });
  }
};

export const updateSupportSettings = async (req: Request, res: Response) => {
  const settings = parseSupportBody(req.body);

  if (!settings) {
    res.status(400).json({
      message: "Invalid email. Provide a valid support email address.",
    });
    return;
  }

  try {
    const saved = await saveSupportSettings(settings);
    res.status(200).json({
      message: "Support email updated successfully",
      settings: saved,
    });
  } catch (error) {
    console.error("Error saving support settings:", error);
    res.status(500).json({
      message:
        "Failed to save settings. Ensure support table exists in the database.",
    });
  }
};
