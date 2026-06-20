import { db } from '../../db/database';

/** SQLiteへJSON文字列として保存するアプリ設定値。 */
export type AppSettingValue = boolean | number | string | null;

/** 一括保存するアプリ設定のキーと値。 */
export interface AppSettingEntry {
  key: string;
  value: AppSettingValue;
}

/** 指定された更新日時を使い、アプリ設定をUPSERTで保存する。 */
async function upsertSetting(key: string, value: AppSettingValue, updatedAt: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    updatedAt,
  );
}

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



/** string設定を読み込み、未保存または壊れた値の場合はfallbackを返す。 */
export async function getStringSetting(key: string, fallback: string): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);

  if (!row) {
    return fallback;
  }

  try {
    const value = JSON.parse(row.value);
    return typeof value === 'string' ? value : fallback;
  } catch {
    return fallback;
  }
}

/** アプリ設定をUPSERTで保存する。 */
export async function setSetting(key: string, value: AppSettingValue): Promise<void> {
  const now = new Date().toISOString();

  await upsertSetting(key, value, now);
}

/** 複数のアプリ設定を同じ更新日時で原子的に保存する。 */
export async function setSettings(entries: AppSettingEntry[]): Promise<void> {
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const entry of entries) {
      await upsertSetting(entry.key, entry.value, now);
    }
  });
}
