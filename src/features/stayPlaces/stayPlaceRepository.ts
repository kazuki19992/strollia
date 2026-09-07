import { db, withExclusiveTransaction } from '@/db/database';
import { isStayPlaceEmojiHexcode } from '@/features/stayPlaces/stayPlaceEmojiCatalog';
import { SaveStayPlaceInput, STAY_PLACE_PRIVACY_RADIUS_METERS, StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

/** 作成順で一覧表示するため、SELECT時に使う滞在場所の列。 */
const stayPlaceColumns = `
  id,
  name,
  icon_hexcode as iconHexcode,
  latitude,
  longitude,
  privacy_radius_meters as privacyRadiusMeters,
  created_at as createdAt,
  updated_at as updatedAt
`;

/** 共有時に非表示にできる半径の集合。 */
const privacyRadiusMeterSet = new Set<number>(STAY_PLACE_PRIVACY_RADIUS_METERS);

/** 保存前に滞在場所入力を検証し、不正な値をSQLiteへ到達させない。 */
function validateSaveStayPlaceInput(input: SaveStayPlaceInput): void {
  if (input.name.trim().length === 0) {
    throw new Error('滞在場所名を入力してください');
  }

  if (!isStayPlaceEmojiHexcode(input.iconHexcode)) {
    throw new Error('滞在場所のアイコンが不正です');
  }

  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new Error('滞在場所の緯度が不正です');
  }

  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new Error('滞在場所の経度が不正です');
  }

  if (input.privacyRadiusMeters !== null && !privacyRadiusMeterSet.has(input.privacyRadiusMeters)) {
    throw new Error('共有時の非表示範囲が不正です');
  }
}

/** 滞在場所を作成日時、同時刻ならIDの昇順で取得する。 */
export async function getStayPlaces(): Promise<StayPlace[]> {
  return db.getAllAsync<StayPlace>(`
    SELECT ${stayPlaceColumns}
    FROM stay_places
    ORDER BY created_at ASC, id ASC
  `);
}

/** 入力を検証してから、滞在場所を排他トランザクションで新規保存する。 */
export async function createStayPlace(input: SaveStayPlaceInput): Promise<number> {
  validateSaveStayPlaceInput(input);

  const now = new Date().toISOString();
  let id = 0;
  await withExclusiveTransaction(async (txn) => {
    const result = await txn.runAsync(
      `INSERT INTO stay_places (
        name,
        icon_hexcode,
        latitude,
        longitude,
        privacy_radius_meters,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      input.name,
      input.iconHexcode,
      input.latitude,
      input.longitude,
      input.privacyRadiusMeters,
      now,
      now,
    );
    id = result.lastInsertRowId;
  });

  return id;
}

/** 入力を検証してから、既存の滞在場所を排他トランザクションで更新する。 */
export async function updateStayPlace(id: number, input: SaveStayPlaceInput): Promise<void> {
  validateSaveStayPlaceInput(input);

  await withExclusiveTransaction(async (txn) => {
    await txn.runAsync(
      `UPDATE stay_places
       SET name = ?,
           icon_hexcode = ?,
           latitude = ?,
           longitude = ?,
           privacy_radius_meters = ?,
           updated_at = ?
       WHERE id = ?`,
      input.name,
      input.iconHexcode,
      input.latitude,
      input.longitude,
      input.privacyRadiusMeters,
      new Date().toISOString(),
      id,
    );
  });
}

/** 指定IDの滞在場所だけを排他トランザクションで削除する。 */
export async function deleteStayPlace(id: number): Promise<void> {
  await withExclusiveTransaction(async (txn) => {
    await txn.runAsync('DELETE FROM stay_places WHERE id = ?', id);
  });
}
