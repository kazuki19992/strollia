import { renderHook, waitFor } from '@testing-library/react-native';

import { getLandmarkSpotVisits } from '@/features/landmarks/landmarkVisitRepository';
import { useLandmarkPackState } from '@/ui/hooks/useLandmarkPackState';

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getLandmarkSpotVisits: jest.fn(),
}));

/**
 * 無料パック1件・有料パック1件を差し込んで検証する。
 *
 * 実マスタは全パックが無料のため(2026-09-27時点)、有料パックの施錠経路をテストするには
 * 生成物をモックする必要がある。
 */
jest.mock('@/features/landmarks/landmarkCatalog.generated', () => ({
  GENERATED_LANDMARK_PACKS: [
    { id: 'pack-free', name: '無料パック', description: '説明', trophyImage: 1, sortOrder: 1, isFree: true },
    { id: 'pack-paid', name: '有料パック', description: '説明', trophyImage: 1, sortOrder: 2, isFree: false },
  ],
  GENERATED_LANDMARK_SPOTS: [
    {
      id: 'spot-free',
      name: '無料スポット',
      prefectures: ['TOKYO'],
      latitude: 35.0,
      longitude: 139.0,
      radiusMeters: 200,
      dwellSeconds: 180,
      packs: [{ packId: 'pack-free', order: 1 }],
    },
    {
      id: 'spot-paid',
      name: '有料スポット',
      prefectures: ['TOKYO'],
      latitude: 35.1,
      longitude: 139.1,
      radiusMeters: 200,
      dwellSeconds: 180,
      packs: [{ packId: 'pack-paid', order: 1 }],
    },
  ],
}));

describe('無料/有料パックが混在するときのuseLandmarkPackState', () => {
  beforeEach(() => {
    (getLandmarkSpotVisits as jest.Mock).mockResolvedValue([]);
  });

  it('Plus無効なら無料パックは施錠されず、有料パックは施錠される', async () => {
    const { result } = renderHook(() => useLandmarkPackState(false));

    await waitFor(() => {
      expect(result.current.landmarkPackItems.length).toBe(2);
    });

    const freeItem = result.current.landmarkPackItems.find((item) => item.pack.id === 'pack-free');
    const paidItem = result.current.landmarkPackItems.find((item) => item.pack.id === 'pack-paid');

    expect(freeItem?.isLocked).toBe(false);
    expect(paidItem?.isLocked).toBe(true);
  });

  it('Plus有効ならどちらも施錠されない', async () => {
    const { result } = renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(result.current.landmarkPackItems.length).toBe(2);
    });

    expect(result.current.landmarkPackItems.every((item) => !item.isLocked)).toBe(true);
  });
});
