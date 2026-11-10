import { renderHook, waitFor } from '@testing-library/react-native';

import { getLandmarkAreaVisits, getLandmarkSpotVisits } from '@/features/landmarks/landmarkVisitRepository';
import { useLandmarkPackState } from '@/ui/hooks/useLandmarkPackState';

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getLandmarkSpotVisits: jest.fn(),
  getLandmarkAreaVisits: jest.fn(),
}));

/** 複数地点スポット1件と円1つのスポット1件を持つパックを差し込む。 */
jest.mock('@/features/landmarks/landmarkCatalog.generated', () => {
  const packId = 'pack-multi';

  return {
    GENERATED_LANDMARK_PACKS: [{ id: packId, name: '複数地点パック', description: '説明', trophyImage: 1, sortOrder: 1, isFree: true }],
    GENERATED_LANDMARK_SPOTS: [
      {
        id: 'spot-multi',
        name: '複数地点スポット',
        prefectures: ['TOKYO'],
        areas: [
          { id: 'area-a', name: '地点A', latitude: 35.0, longitude: 139.0, radiusMeters: 200, dwellSeconds: 180 },
          { id: 'area-b', name: '地点B', latitude: 35.1, longitude: 139.1, radiusMeters: 200, dwellSeconds: 180 },
        ],
        isMultiArea: true,
        packs: [{ packId, order: 1 }],
      },
      {
        id: 'spot-single',
        name: '円1つのスポット',
        prefectures: ['TOKYO'],
        areas: [{ id: 'spot-single', name: '円1つのスポット', latitude: 35.2, longitude: 139.2, radiusMeters: 200, dwellSeconds: 180 }],
        isMultiArea: false,
        packs: [{ packId, order: 2 }],
      },
    ],
  };
});

describe('複数地点スポットを含むパック状態 useLandmarkPackState', () => {
  beforeEach(() => {
    (getLandmarkSpotVisits as jest.Mock).mockResolvedValue([]);
    (getLandmarkAreaVisits as jest.Mock).mockResolvedValue([
      { areaId: 'area-a', spotId: 'spot-multi', visitedAt: '2026-04-12T02:00:00.000Z', visitedLocalDate: '2026-04-12', locationPointId: 1 },
    ]);
  });

  it('複数地点スポットは地点ごとの到達日を areaItems に持つ', async () => {
    const { result } = await renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(result.current.getLandmarkPackDetail('pack-multi')?.spotItems[0]?.areaItems[0]?.visitedLocalDate).toBe('2026-04-12');
    });

    const item = result.current.getLandmarkPackDetail('pack-multi')?.spotItems[0];

    expect(item?.areaItems.map((areaItem) => areaItem.area.id)).toEqual(['area-a', 'area-b']);
    expect(item?.areaItems[1]?.visitedLocalDate).toBeNull();
  });

  it('円1つのスポットの areaItems は空', async () => {
    const { result } = await renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(getLandmarkAreaVisits).toHaveBeenCalled();
    });

    expect(result.current.getLandmarkPackDetail('pack-multi')?.spotItems[1]?.areaItems).toEqual([]);
  });

  it('地点だけ到達してもパックの到達数は増えない', async () => {
    const { result } = await renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(result.current.getLandmarkPackDetail('pack-multi')?.spotItems[0]?.areaItems[0]?.visitedLocalDate).toBe('2026-04-12');
    });

    expect(result.current.landmarkPackItems[0]?.visitedCount).toBe(0);
    expect(result.current.landmarkPackItems[0]?.totalCount).toBe(2);
    expect(result.current.getLandmarkPackDetail('pack-multi')?.spotItems[0]?.visitedLocalDate).toBeNull();
  });
});
