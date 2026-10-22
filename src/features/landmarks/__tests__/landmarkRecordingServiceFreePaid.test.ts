import { getLandmarkDetectionSnapshotForRecording } from '@/features/landmarks/landmarkRecordingService';
import { getVisitedLandmarkSpotIds } from '@/features/landmarks/landmarkVisitRepository';
import { getConfirmedPremiumAccessState } from '@/features/premium/revenueCatAccess';

jest.mock('@/features/premium/revenueCatAccess', () => ({
  getConfirmedPremiumAccessState: jest.fn(),
}));

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getVisitedLandmarkSpotIds: jest.fn(),
}));

/**
 * 無料パック1件・有料パック1件を差し込んで検証する。
 *
 * 実マスタは全パックが無料のため、有料パックのスポットを除外する経路をテストするには
 * 生成物をモックする必要がある。`landmarkRecordingService.test.ts` の他のテスト(実マスタを使う)と
 * 混在させると `jest.mock` はファイル内の全テストへ静的に適用されてしまうため、
 * このケースだけ別ファイルへ分離している(計画書が許容する代替方式)。
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

describe('無料/有料パックが混在する場合の landmarkRecordingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVisitedLandmarkSpotIds as jest.Mock).mockResolvedValue(new Set());
  });

  it('Plus無効なら無料スポットだけを返し、有料スポットは除く', async () => {
    (getConfirmedPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });

    const snapshot = await getLandmarkDetectionSnapshotForRecording();

    expect(snapshot.status).toBe('enabled');
    if (snapshot.status === 'enabled') {
      const ids = snapshot.spots.map((spot) => spot.id);
      expect(ids).toContain('spot-free');
      expect(ids).not.toContain('spot-paid');
    }
  });

  it('Plus有効なら有料スポットも含める', async () => {
    (getConfirmedPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' });

    const snapshot = await getLandmarkDetectionSnapshotForRecording();

    expect(snapshot.status).toBe('enabled');
    if (snapshot.status === 'enabled') {
      const ids = snapshot.spots.map((spot) => spot.id);
      expect(ids).toContain('spot-free');
      expect(ids).toContain('spot-paid');
    }
  });
});
