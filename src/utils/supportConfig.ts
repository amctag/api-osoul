import { pool } from "../config/dp";

export type SupportSettings = {
  email: string;
};

const DEFAULT_SUPPORT_EMAIL = "osoulappdeveloper@gmail.com";

export function getDefaultSupportSettings(): SupportSettings {
  return {
    email: process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL,
  };
}

export async function loadSupportSettings(): Promise<SupportSettings> {
  try {
    const result = await pool.query(
      `SELECT email FROM support WHERE id = 1`
    );

    if ((result.rowCount ?? 0) > 0) {
      return { email: result.rows[0].email };
    }
  } catch (error) {
    console.warn(
      "support table unavailable, using default email:",
      (error as Error).message
    );
  }

  return getDefaultSupportSettings();
}

export async function saveSupportSettings(
  settings: SupportSettings
): Promise<SupportSettings> {
  const result = await pool.query(
    `INSERT INTO support (id, email, updated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       updated_at = NOW()
     RETURNING email`,
    [settings.email]
  );

  return { email: result.rows[0].email };
}
