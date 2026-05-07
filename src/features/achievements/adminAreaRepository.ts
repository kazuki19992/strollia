import { db } from '../../db/database';

/** 訪問エリアの種類。 */
export type AdminAreaType = 'prefecture' | 'municipality';

/** 訪問済み行政区域として保存する値。 */
export type VisitedAdminAreaInput = {
  areaType: AdminAreaType;
  areaCode: string | null;
  prefectureName: string;
  municipalityName: string | null;
  normalizedName: string;
  visitedAt: string;
  firstLocationPointId?: number | null;
};

/** 訪問済み行政区域をUPSERTで保存する。 */
export async function upsertVisitedAdminArea(area: VisitedAdminAreaInput): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO visited_admin_areas (
      area_type,
      area_code,
      prefecture_name,
      municipality_name,
      normalized_name,
      first_visited_at,
      last_visited_at,
      first_location_point_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(area_type, normalized_name) DO UPDATE SET
      last_visited_at = CASE
        WHEN excluded.last_visited_at > visited_admin_areas.last_visited_at
        THEN excluded.last_visited_at
        ELSE visited_admin_areas.last_visited_at
      END,
      updated_at = excluded.updated_at`,
    area.areaType,
    area.areaCode,
    area.prefectureName,
    area.municipalityName,
    area.normalizedName,
    area.visitedAt,
    area.visitedAt,
    area.firstLocationPointId ?? null,
    now,
    now,
  );
}
