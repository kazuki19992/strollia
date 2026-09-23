import {
  LANDMARK_PACKS,
  LANDMARK_SPOTS,
  getActiveSpotsForPack,
  getLandmarkPackById,
  getLandmarkPackCompletionAchievementId,
  getLandmarkSpotById,
} from '@/features/landmarks/landmarkCatalog';

/** パイロットの日本三名瀑パックID。 */
const FALLS_PACK_ID = '01a0c450-6c00-7000-8000-000000000001';

describe('スポット実績カタログ landmarkCatalog', () => {
  it('スポットIDが重複していない', () => {
    const ids = LANDMARK_SPOTS.map((spot) => spot.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('緯度経度が日本国内の範囲に収まっている', () => {
    for (const spot of LANDMARK_SPOTS) {
      expect(spot.latitude).toBeGreaterThanOrEqual(20);
      expect(spot.latitude).toBeLessThanOrEqual(46);
      expect(spot.longitude).toBeGreaterThanOrEqual(122);
      expect(spot.longitude).toBeLessThanOrEqual(154);
    }
  });

  it('半径は正の値、滞在時間は0以上である', () => {
    for (const spot of LANDMARK_SPOTS) {
      expect(spot.radiusMeters).toBeGreaterThan(0);
      expect(spot.dwellSeconds).toBeGreaterThanOrEqual(0);
    }
  });

  it('すべてのスポットが実在するパックを参照している', () => {
    const packIds = new Set(LANDMARK_PACKS.map((pack) => pack.id));

    for (const spot of LANDMARK_SPOTS) {
      for (const membership of spot.packs) {
        expect(packIds.has(membership.packId)).toBe(true);
      }
    }
  });

  it('スポットを1件も持たないパックが存在しない', () => {
    for (const pack of LANDMARK_PACKS) {
      expect(getActiveSpotsForPack(pack.id).length).toBeGreaterThan(0);
    }
  });

  it('パックのスポットはorder昇順で返る', () => {
    const names = getActiveSpotsForPack(FALLS_PACK_ID).map((spot) => spot.name);

    expect(names).toEqual(['華厳の滝', '那智の滝', '袋田の滝']);
  });

  it('IDからスポットとパックを引ける', () => {
    expect(getLandmarkSpotById('01a0c450-6c00-7000-8000-000000000101')?.name).toBe('華厳の滝');
    expect(getLandmarkPackById(FALLS_PACK_ID)?.name).toBe('日本三名瀑');
  });

  it('未知のIDにはnullを返す', () => {
    expect(getLandmarkSpotById('01a0c450-6c00-7000-8000-00000000ffff')).toBeNull();
    expect(getLandmarkPackById('01a0c450-6c00-7000-8000-00000000ffff')).toBeNull();
  });

  it('パックIDから完走実績IDを導出できる', () => {
    expect(getLandmarkPackCompletionAchievementId(FALLS_PACK_ID)).toBe(`landmark-pack-${FALLS_PACK_ID}`);
  });
});
