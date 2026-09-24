import { Image } from 'react-native';

import {
  GENERATED_LANDMARK_PACKS,
  GENERATED_LANDMARK_SPOTS,
  type GeneratedLandmarkPack,
  type GeneratedLandmarkSpot,
} from './landmarkCatalog.generated';

/** 到達判定の対象となる1地点。 */
export type LandmarkSpot = GeneratedLandmarkSpot;

/** 完走トロフィーの通知添付URIを含むパック定義。 */
export type LandmarkPack = GeneratedLandmarkPack & {
  /** 通知添付に使うトロフィー画像URI。解決できない場合はnull。 */
  trophyImageUri: string | null;
};

/** アプリ全体で参照するスポット一覧。 */
export const LANDMARK_SPOTS: readonly LandmarkSpot[] = GENERATED_LANDMARK_SPOTS;

/** アプリ全体で参照するパック一覧。表示順で並べる。 */
export const LANDMARK_PACKS: readonly LandmarkPack[] = [...GENERATED_LANDMARK_PACKS]
  .sort((left, right) => left.sortOrder - right.sortOrder)
  .map((pack) => ({ ...pack, trophyImageUri: Image.resolveAssetSource(pack.trophyImage)?.uri ?? null }));

/** IDからスポットを取得する。未知のIDはnull。 */
export function getLandmarkSpotById(id: string): LandmarkSpot | null {
  return LANDMARK_SPOTS.find((spot) => spot.id === id) ?? null;
}

/** IDからパックを取得する。未知のIDはnull。 */
export function getLandmarkPackById(id: string): LandmarkPack | null {
  return LANDMARK_PACKS.find((pack) => pack.id === id) ?? null;
}

/**
 * パックに属する有効なスポットをorder昇順で返す。
 *
 * `retired` なスポットは完走判定の分母から外すため除外する。
 * 既に到達済みのユーザーの実績はルール1により取り消されないため、分母が減っても矛盾しない。
 */
export function getActiveSpotsForPack(packId: string): readonly LandmarkSpot[] {
  return getAllSpotsForPack(packId).filter((spot) => !spot.retired);
}

/**
 * パックに属する全スポットを `retired` も含めて order 昇順で返す。
 *
 * パック詳細画面の一覧表示に使う。`retired` なスポットを一覧から消すと、
 * 「現存せず」の表示ができなくなるうえ、そこへ到達済みのユーザーが
 * その日の記録への導線を失うため、表示上は残して分母からだけ外す。
 */
export function getAllSpotsForPack(packId: string): readonly LandmarkSpot[] {
  return LANDMARK_SPOTS.filter((spot) => spot.packs.some((membership) => membership.packId === packId)).sort(
    (left, right) => getPackOrder(left, packId) - getPackOrder(right, packId),
  );
}

/** 到達判定の候補になる全スポット(retiredを除く)を返す。 */
export function getDetectableLandmarkSpots(): readonly LandmarkSpot[] {
  return LANDMARK_SPOTS.filter((spot) => !spot.retired);
}

/**
 * パック完走実績のIDをパックIDから導出する。
 *
 * achievement_unlocks へ保存されるため安定性が最優先であり、可読性は二の次でよい。
 * マスタから機械的に導くことで、パックと実績定義が食い違う余地をなくす。
 */
export function getLandmarkPackCompletionAchievementId(packId: string): string {
  return `landmark-pack-${packId}`;
}

/** 完走実績IDからパックIDを取り出す。形式が違う場合はnull。 */
export function parseLandmarkPackCompletionAchievementId(achievementId: string): string | null {
  const prefix = 'landmark-pack-';
  return achievementId.startsWith(prefix) ? achievementId.slice(prefix.length) : null;
}

/** 指定パック内での表示順を取り出す。所属していない場合は末尾扱い。 */
function getPackOrder(spot: LandmarkSpot, packId: string): number {
  return spot.packs.find((membership) => membership.packId === packId)?.order ?? Number.MAX_SAFE_INTEGER;
}
