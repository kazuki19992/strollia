import { developmentFlags } from '@/config/developmentFlags';
import { createPhotoScanMetricsLines, formatPhotoScanMetricsLines, type PhotoScanMetrics } from '@/features/photos/photoScanMetrics';

/** テスト用の計測値。 */
const METRICS: PhotoScanMetrics = {
  scannedAssetCount: 2000,
  geotaggedPhotoCount: 143,
  locationRejectedCount: 2,
  metadataDurationMs: 320,
  locationDurationMs: 11800,
  saveDurationMs: 1234,
  totalDurationMs: 13300,
};

describe('写真走査の計測表示 formatPhotoScanMetricsLines', () => {
  it('件数の内訳を1行目に出す', () => {
    expect(formatPhotoScanMetricsLines(METRICS)[0]).toBe('走査 2000件 / ジオタグ 143件 / 失敗 2件');
  });

  it('所要時間の内訳を秒(小数1桁)で2行目に出す', () => {
    expect(formatPhotoScanMetricsLines(METRICS)[1]).toBe('メタデータ 0.3s / 位置 11.8s / 保存 1.2s / 合計 13.3s');
  });

  it('1秒未満の所要時間も秒表示にする', () => {
    const lines = formatPhotoScanMetricsLines({ ...METRICS, metadataDurationMs: 0, totalDurationMs: 60 });

    expect(lines[1]).toBe('メタデータ 0.0s / 位置 11.8s / 保存 1.2s / 合計 0.1s');
  });
});

describe('写真走査の計測表示行の生成 createPhotoScanMetricsLines', () => {
  it('計測フラグが無効な場合はnullを返す(一切表示しない)', () => {
    jest.replaceProperty(developmentFlags, 'logPhotoScanMetrics', false);

    expect(createPhotoScanMetricsLines(METRICS)).toBeNull();
  });

  it('計測フラグが有効な場合は表示行を返す', () => {
    jest.replaceProperty(developmentFlags, 'logPhotoScanMetrics', true);

    expect(createPhotoScanMetricsLines(METRICS)).toEqual(formatPhotoScanMetricsLines(METRICS));
  });

  it('計測フラグが有効でも計測値が無い場合はnullを返す', () => {
    jest.replaceProperty(developmentFlags, 'logPhotoScanMetrics', true);

    expect(createPhotoScanMetricsLines(null)).toBeNull();
  });
});
