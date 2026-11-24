/* global jest -- Jest の setupFilesAfterEnv で読み込まれ、jest グローバルが使える */
/**
 * 全テスト共通: 年間レポートの集計対象を「期間外(null)」に固定する。
 *
 * AppStateProvider は実際の日付で年間レポートの集計を起動する(12/16〜1/15)。
 * renderRouter('src/app') などで実 Provider を描画するテストが、その期間だけ
 * DB・集計処理に触れて壊れないよう、日付に依存しない状態を既定にする。
 * 期間判定そのものや集計フックを検証するテストは、ファイル先頭で
 * `jest.unmock('@/features/annualReport/annualReportPeriod')` して実装を使う。
 */
jest.mock('@/features/annualReport/annualReportPeriod', () => ({
  ...jest.requireActual('@/features/annualReport/annualReportPeriod'),
  resolveAggregationWindow: jest.fn(() => null),
}));
