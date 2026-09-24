import { getActiveSpotsForPack, getAllSpotsForPack } from '@/features/landmarks/landmarkCatalog';

/**
 * retired を含むマスタを差し込んで検証する。
 *
 * パイロットの実マスタには retired なスポットが1件も無いため、
 * 生成物をモックしないと「現存せず」の経路をテストできない。
 */
jest.mock('@/features/landmarks/landmarkCatalog.generated', () => {
  const packId = 'pack-test';

  return {
    GENERATED_LANDMARK_PACKS: [{ id: packId, name: 'テストパック', description: '説明', trophyImage: 1, sortOrder: 100 }],
    GENERATED_LANDMARK_SPOTS: [
      {
        id: 'spot-active-2',
        name: '現存するスポット2',
        prefectures: ['TOKYO'],
        latitude: 35.0,
        longitude: 139.0,
        radiusMeters: 200,
        dwellSeconds: 180,
        packs: [{ packId, order: 2 }],
      },
      {
        id: 'spot-retired',
        name: '現存しないスポット',
        prefectures: ['TOKYO'],
        latitude: 35.1,
        longitude: 139.1,
        radiusMeters: 200,
        dwellSeconds: 180,
        retired: true,
        packs: [{ packId, order: 3 }],
      },
      {
        id: 'spot-active-1',
        name: '現存するスポット1',
        prefectures: ['TOKYO'],
        latitude: 35.2,
        longitude: 139.2,
        radiusMeters: 200,
        dwellSeconds: 180,
        packs: [{ packId, order: 1 }],
      },
    ],
  };
});

describe('retiredスポットのパック所属', () => {
  it('詳細表示用の一覧にはretiredも含める', () => {
    // 一覧から消すと「現存せず」を表示できず、到達済みユーザーがその日の記録への導線を失う
    const names = getAllSpotsForPack('pack-test').map((spot) => spot.name);

    expect(names).toEqual(['現存するスポット1', '現存するスポット2', '現存しないスポット']);
  });

  it('完走判定用の一覧からはretiredを除く', () => {
    const names = getActiveSpotsForPack('pack-test').map((spot) => spot.name);

    expect(names).toEqual(['現存するスポット1', '現存するスポット2']);
  });

  it('どちらの一覧もorder昇順で返す', () => {
    expect(getAllSpotsForPack('pack-test').map((spot) => spot.id)).toEqual(['spot-active-1', 'spot-active-2', 'spot-retired']);
  });

  it('所属スポットが無いパックIDには空配列を返す', () => {
    expect(getAllSpotsForPack('pack-unknown')).toEqual([]);
  });
});
