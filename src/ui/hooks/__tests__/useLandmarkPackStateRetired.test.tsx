import { renderHook, waitFor } from '@testing-library/react-native';

import { getLandmarkSpotVisits } from '@/features/landmarks/landmarkVisitRepository';
import { useLandmarkPackState } from '@/ui/hooks/useLandmarkPackState';

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getLandmarkSpotVisits: jest.fn(),
}));

/**
 * retired を含むマスタを差し込んで検証する。
 *
 * パイロットの実マスタには retired なスポットが1件も無いため、
 * 生成物をモックしないと「現存せず」の表示経路をテストできない。
 */
jest.mock('@/features/landmarks/landmarkCatalog.generated', () => {
  const packId = 'pack-test';

  return {
    GENERATED_LANDMARK_PACKS: [{ id: packId, name: 'テストパック', description: '説明', trophyImage: 1, sortOrder: 100 }],
    GENERATED_LANDMARK_SPOTS: [
      {
        id: 'spot-active',
        name: '現存するスポット',
        prefecture: 'TOKYO',
        latitude: 35.0,
        longitude: 139.0,
        radiusMeters: 200,
        dwellSeconds: 180,
        packs: [{ packId, order: 1 }],
      },
      {
        id: 'spot-retired',
        name: '現存しないスポット',
        prefecture: 'TOKYO',
        latitude: 35.1,
        longitude: 139.1,
        radiusMeters: 200,
        dwellSeconds: 180,
        retired: true,
        packs: [{ packId, order: 2 }],
      },
    ],
  };
});

describe('retiredスポットを含むパックの詳細', () => {
  beforeEach(() => {
    (getLandmarkSpotVisits as jest.Mock).mockResolvedValue([
      { spotId: 'spot-retired', visitedAt: '2026-04-12T02:00:00.000Z', visitedLocalDate: '2026-04-12', locationPointId: 1 },
    ]);
  });

  it('詳細の行にはretiredスポットも含める', async () => {
    const { result } = renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(result.current.getLandmarkPackDetail('pack-test')?.spotItems[1]?.visitedLocalDate).toBe('2026-04-12');
    });

    const spotItems = result.current.getLandmarkPackDetail('pack-test')?.spotItems ?? [];
    expect(spotItems.map((item) => item.spot.name)).toEqual(['現存するスポット', '現存しないスポット']);
  });

  it('retiredスポットへ到達済みならその日の記録への導線を残す', async () => {
    // 一覧から消してしまうと、到達済みユーザーが記録へ辿り着けなくなる
    const { result } = renderHook(() => useLandmarkPackState(true));

    // getLandmarkPackDetail は読み込み完了前でも非nullを返すため、到達日そのものを待つ
    await waitFor(() => {
      const item = result.current.getLandmarkPackDetail('pack-test')?.spotItems.find((spotItem) => spotItem.spot.retired);
      expect(item?.visitedLocalDate).toBe('2026-04-12');
    });
  });

  it('一覧の分母はretiredを除いた件数になる', async () => {
    const { result } = renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(result.current.landmarkPackItems[0]?.totalCount).toBe(1);
    });

    // retired への到達は分子にも数えない
    expect(result.current.landmarkPackItems[0]?.visitedCount).toBe(0);
  });
});
