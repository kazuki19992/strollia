import { db } from '../../db/database';

export type AppSettingValue = boolean | number | string | null;

export async function getBooleanSetting(key: string, fallback: boolean): Promise<boolean> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);

  if (!row) {
    return fallback;
  }

  try {
    return Boolean(JSON.parse(row.value));
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: AppSettingValue): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    now,
  );
}
