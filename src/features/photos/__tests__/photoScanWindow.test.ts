import {
  createPhotoAssetReconciliation,
  resolveRetainedAssetIds,
  resolveScannedWindowOldestTakenAt,
  type ScannedAssetOutcome,
} from '@/features/photos/photoScanWindow';

/** テスト用の走査結果を作る。 */
function outcome(overrides: Partial<ScannedAssetOutcome> = {}): ScannedAssetOutcome {
  return {
    assetId: 'asset-1',
    isInfoResolved: true,
    isSaved: true,
    ...overrides,
  };
}

describe('走査済み時間窓の下限 resolveScannedWindowOldestTakenAt', () => {
  it('ページ内で最も古い撮影日時をISO 8601で返す', () => {
    expect(resolveScannedWindowOldestTakenAt([{ creationTime: 3000 }, { creationTime: 1000 }, { creationTime: 2000 }])).toBe(
      new Date(1000).toISOString(),
    );
  });

  it('撮影日時を持たないアセットは下限の計算から除外する', () => {
    expect(resolveScannedWindowOldestTakenAt([{ creationTime: 5000 }, { creationTime: null }, {}])).toBe(new Date(5000).toISOString());
  });

  it('0以下や非有限の撮影日時は不正値として無視する', () => {
    expect(
      resolveScannedWindowOldestTakenAt([{ creationTime: 0 }, { creationTime: -1 }, { creationTime: Number.NaN }, { creationTime: 7000 }]),
    ).toBe(new Date(7000).toISOString());
  });

  it('撮影日時がひとつも取れない場合はnullを返す', () => {
    expect(resolveScannedWindowOldestTakenAt([{ creationTime: 0 }, {}])).toBeNull();
  });

  it('アセットが空の場合はnullを返す', () => {
    expect(resolveScannedWindowOldestTakenAt([])).toBeNull();
  });
});

describe('残すアセットIDの算出 resolveRetainedAssetIds', () => {
  it('今回の走査で再保存したアセットは残す', () => {
    expect(resolveRetainedAssetIds([outcome({ assetId: 'saved' })])).toEqual(['saved']);
  });

  it('詳細取得がrejectされたアセットは、存在するのにジオタグを判断できないため残す', () => {
    expect(resolveRetainedAssetIds([outcome({ assetId: 'rejected', isInfoResolved: false, isSaved: false })])).toEqual(['rejected']);
  });

  it('詳細取得に成功してジオタグが無かったアセットは残さない', () => {
    expect(resolveRetainedAssetIds([outcome({ assetId: 'no-geotag', isInfoResolved: true, isSaved: false })])).toEqual([]);
  });

  it('保存済みとreject済みが混在しても両方を残す', () => {
    expect(
      resolveRetainedAssetIds([
        outcome({ assetId: 'saved' }),
        outcome({ assetId: 'no-geotag', isSaved: false }),
        outcome({ assetId: 'rejected', isInfoResolved: false, isSaved: false }),
      ]),
    ).toEqual(['saved', 'rejected']);
  });
});

describe('突き合わせ条件の組み立て createPhotoAssetReconciliation', () => {
  it('ライブラリ末尾まで走査した場合は全期間を突き合わせ対象にする', () => {
    expect(
      createPhotoAssetReconciliation({
        assets: [{ creationTime: 1000 }],
        outcomes: [outcome({ assetId: 'asset-1' })],
        hasNextPage: false,
      }),
    ).toEqual({ scannedEntireLibrary: true, retainedAssetIds: ['asset-1'] });
  });

  it('続きのページがある場合はページ内最古の撮影日時を下限とした窓になる', () => {
    expect(
      createPhotoAssetReconciliation({
        assets: [{ creationTime: 3000 }, { creationTime: 1000 }],
        outcomes: [outcome({ assetId: 'asset-1' })],
        hasNextPage: true,
      }),
    ).toEqual({ scannedEntireLibrary: false, exclusiveOldestTakenAt: new Date(1000).toISOString(), retainedAssetIds: ['asset-1'] });
  });

  it('下限は排他として返すため、ページ内最古と同じ撮影日時の写真は窓の外に置かれる', () => {
    // バースト撮影などで同一時刻の写真がページ境界をまたぐと、次ページ側の未走査写真を
    // 「確認できなかった」と誤判定して削除してしまう。下限を排他にして境界時刻を窓から外す
    const reconciliation = createPhotoAssetReconciliation({
      assets: [{ creationTime: 2000 }, { creationTime: 1000 }, { creationTime: 1000 }],
      outcomes: [outcome({ assetId: 'asset-1' })],
      hasNextPage: true,
    });

    expect(reconciliation).toEqual({
      scannedEntireLibrary: false,
      exclusiveOldestTakenAt: new Date(1000).toISOString(),
      retainedAssetIds: ['asset-1'],
    });
  });

  it('続きのページがあり下限を計算できない場合は突き合わせを行わない', () => {
    expect(
      createPhotoAssetReconciliation({
        assets: [{ creationTime: 0 }, {}],
        outcomes: [outcome({ assetId: 'asset-1' })],
        hasNextPage: true,
      }),
    ).toBeNull();
  });

  it('ライブラリ末尾まで走査していれば下限を計算できなくても突き合わせる', () => {
    expect(
      createPhotoAssetReconciliation({
        assets: [{}],
        outcomes: [outcome({ assetId: 'asset-1' })],
        hasNextPage: false,
      }),
    ).toEqual({ scannedEntireLibrary: true, retainedAssetIds: ['asset-1'] });
  });

  it('ページが空でライブラリ末尾なら、残す対象なしの全期間突き合わせになる', () => {
    // 写真ライブラリが空になったケース。保存済みの行はすべて削除されるのが正しい
    expect(createPhotoAssetReconciliation({ assets: [], outcomes: [], hasNextPage: false })).toEqual({
      scannedEntireLibrary: true,
      retainedAssetIds: [],
    });
  });

  it('ページが空で続きのページがある場合は突き合わせを行わない', () => {
    expect(createPhotoAssetReconciliation({ assets: [], outcomes: [], hasNextPage: true })).toBeNull();
  });

  it('hasNextPageが真偽値として得られない場合は安全側に倒し全期間の突き合わせにしない', () => {
    // 実行時に想定外の値が来ても「全部見た」と誤認して削除しないための保険
    expect(
      createPhotoAssetReconciliation({
        assets: [{ creationTime: 1000 }],
        outcomes: [outcome({ assetId: 'asset-1' })],
        hasNextPage: undefined as unknown as boolean,
      }),
    ).toEqual({ scannedEntireLibrary: false, exclusiveOldestTakenAt: new Date(1000).toISOString(), retainedAssetIds: ['asset-1'] });
  });
});
