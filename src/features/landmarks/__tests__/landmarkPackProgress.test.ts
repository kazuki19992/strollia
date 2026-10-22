import { resolveLandmarkPackProgress } from '@/features/landmarks/landmarkPackProgress';

/** パイロットの日本三名瀑パックID。 */
const FALLS_PACK_ID = '01a0c450-6c00-7000-8000-000000000001';

/** 華厳の滝のスポットID。 */
const KEGON_ID = '01a0c450-6c00-7000-8000-000000000101';

/** 那智の滝のスポットID。 */
const NACHI_ID = '01a0c450-6c00-7000-8000-000000000102';

describe('パック進捗 resolveLandmarkPackProgress', () => {
  it('未到達なら0件として返す', () => {
    const [progress] = resolveLandmarkPackProgress(new Set());

    expect(progress).toEqual({ packId: FALLS_PACK_ID, visitedCount: 0, totalCount: 3 });
  });

  it('到達済みスポット数を数える', () => {
    const [progress] = resolveLandmarkPackProgress(new Set([KEGON_ID, NACHI_ID]));

    expect(progress.visitedCount).toBe(2);
    expect(progress.totalCount).toBe(3);
  });

  it('マスタに存在しない到達記録は数えない', () => {
    const [progress] = resolveLandmarkPackProgress(new Set(['01a0c450-6c00-7000-8000-00000000ffff']));

    expect(progress.visitedCount).toBe(0);
  });
});
