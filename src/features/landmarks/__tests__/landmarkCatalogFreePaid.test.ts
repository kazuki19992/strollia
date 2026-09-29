import { isLandmarkSpotInFreePack } from '@/features/landmarks/landmarkCatalog';

/**
 * 無料パック1件・有料パック1件を差し込んで検証する。
 *
 * パイロットの実マスタには無料パックしか無いため(2026-09-27時点)、
 * 生成物をモックしないと「有料パックのみに属するスポットは無料判定されない」経路をテストできない。
 */
jest.mock('@/features/landmarks/landmarkCatalog.generated', () => ({
  GENERATED_LANDMARK_PACKS: [
    { id: 'pack-free', name: '無料パック', description: '説明', trophyImage: 1, sortOrder: 1, isFree: true },
    { id: 'pack-paid', name: '有料パック', description: '説明', trophyImage: 1, sortOrder: 2, isFree: false },
  ],
  GENERATED_LANDMARK_SPOTS: [
    {
      id: 'spot-free-only',
      name: '無料パックのみに属するスポット',
      prefectures: ['TOKYO'],
      latitude: 35.0,
      longitude: 139.0,
      radiusMeters: 200,
      dwellSeconds: 180,
      packs: [{ packId: 'pack-free', order: 1 }],
    },
    {
      id: 'spot-paid-only',
      name: '有料パックのみに属するスポット',
      prefectures: ['TOKYO'],
      latitude: 35.1,
      longitude: 139.1,
      radiusMeters: 200,
      dwellSeconds: 180,
      packs: [{ packId: 'pack-paid', order: 1 }],
    },
    {
      id: 'spot-both',
      name: '両方のパックに属するスポット',
      prefectures: ['TOKYO'],
      latitude: 35.2,
      longitude: 139.2,
      radiusMeters: 200,
      dwellSeconds: 180,
      packs: [
        { packId: 'pack-free', order: 2 },
        { packId: 'pack-paid', order: 2 },
      ],
    },
  ],
}));

describe('スポットの無料判定 isLandmarkSpotInFreePack', () => {
  it('無料パックのみに属するスポットは無料', () => {
    const { getLandmarkSpotById } = jest.requireActual('@/features/landmarks/landmarkCatalog');
    const spot = getLandmarkSpotById('spot-free-only');

    expect(isLandmarkSpotInFreePack(spot)).toBe(true);
  });

  it('有料パックのみに属するスポットは無料ではない', () => {
    const { getLandmarkSpotById } = jest.requireActual('@/features/landmarks/landmarkCatalog');
    const spot = getLandmarkSpotById('spot-paid-only');

    expect(isLandmarkSpotInFreePack(spot)).toBe(false);
  });

  it('無料パックと有料パックの両方に属するスポットは無料(1つでも無料なら無料)', () => {
    const { getLandmarkSpotById } = jest.requireActual('@/features/landmarks/landmarkCatalog');
    const spot = getLandmarkSpotById('spot-both');

    expect(isLandmarkSpotInFreePack(spot)).toBe(true);
  });
});
