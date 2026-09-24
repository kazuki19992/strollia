import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getLandmarkSpotVisits } from '@/features/landmarks/landmarkVisitRepository';
import { useLandmarkPackState } from '@/ui/hooks/useLandmarkPackState';

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getLandmarkSpotVisits: jest.fn(),
}));

/** パイロットの日本三名瀑パックID。 */
const FALLS_PACK_ID = '01a0c450-6c00-7000-8000-000000000001';
/** 華厳の滝のスポットID。 */
const KEGON_ID = '01a0c450-6c00-7000-8000-000000000101';

describe('スポットパック状態 useLandmarkPackState', () => {
  beforeEach(() => {
    (getLandmarkSpotVisits as jest.Mock).mockResolvedValue([
      { spotId: KEGON_ID, visitedAt: '2026-04-12T02:00:00.000Z', visitedLocalDate: '2026-04-12', locationPointId: 1 },
    ]);
  });

  it('Plus有効なら到達数つきのパック一覧を返す', async () => {
    const { result } = renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(result.current.landmarkPackItems[0]?.visitedCount).toBe(1);
    });

    expect(result.current.landmarkPackItems[0]?.totalCount).toBe(3);
    expect(result.current.landmarkPackItems[0]?.isLocked).toBe(false);
  });

  it('Plus無効なら先頭1件だけを施錠状態で返す', async () => {
    const { result } = renderHook(() => useLandmarkPackState(false));

    await waitFor(() => {
      expect(result.current.landmarkPackItems.length).toBe(1);
    });

    expect(result.current.landmarkPackItems[0]?.isLocked).toBe(true);
    // 検知していない期間の進捗を出すと誤解を招くため、到達数は0で返す
    expect(result.current.landmarkPackItems[0]?.visitedCount).toBe(0);
  });

  it('パック詳細に到達日を含め、未到達はnullにする', async () => {
    const { result } = renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(result.current.getLandmarkPackDetail(FALLS_PACK_ID)?.spotItems[0]?.visitedLocalDate).toBe('2026-04-12');
    });

    const detail = result.current.getLandmarkPackDetail(FALLS_PACK_ID);

    expect(detail?.pack.name).toBe('日本三名瀑');
    expect(detail?.spotItems[1]?.visitedLocalDate).toBeNull();
  });

  it('未知のパックIDにはnullを返す', async () => {
    const { result } = renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(getLandmarkSpotVisits).toHaveBeenCalled();
    });

    expect(result.current.getLandmarkPackDetail('01a0c450-6c00-7000-8000-00000000ffff')).toBeNull();
  });

  it('reloadLandmarkStateで到達記録を読み直す', async () => {
    const { result } = renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(result.current.landmarkPackItems[0]?.visitedCount).toBe(1);
    });

    (getLandmarkSpotVisits as jest.Mock).mockResolvedValue([
      { spotId: KEGON_ID, visitedAt: '2026-04-12T02:00:00.000Z', visitedLocalDate: '2026-04-12', locationPointId: 1 },
      {
        spotId: '01a0c450-6c00-7000-8000-000000000102',
        visitedAt: '2026-04-13T02:00:00.000Z',
        visitedLocalDate: '2026-04-13',
        locationPointId: 2,
      },
    ]);

    await act(async () => {
      await result.current.reloadLandmarkState();
    });

    expect(result.current.landmarkPackItems[0]?.visitedCount).toBe(2);
  });

  it('到達記録の取得に失敗しても一覧は空の進捗で表示できる', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (getLandmarkSpotVisits as jest.Mock).mockRejectedValue(new Error('db error'));

    const { result } = renderHook(() => useLandmarkPackState(true));

    await waitFor(() => {
      expect(console.warn).toHaveBeenCalled();
    });

    expect(result.current.landmarkPackItems[0]?.visitedCount).toBe(0);
    expect(result.current.landmarkPackItems[0]?.totalCount).toBe(3);
  });
});
