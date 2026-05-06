import { db } from '../../db/database';

/** SQLiteへJSON文字列として保存するアプリ設定値。 */
export type AppSettingValue = boolean | number | string | null;

/** boolean設定を読み込み、未保存または壊れた値の場合はfallbackを返す。 */
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

/** アプリ設定をUPSERTで保存する。 */
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
