/** 距離比較の単位。 */
export type DistanceComparisonUnit = '往復分' | '周分' | '回分';

/** ページ3に表示する、総移動距離の比較結果。 */
export type DistanceComparison = {
  /** 比較対象の表記（例: `東京〜大阪`、`地球`）。 */
  label: string;
  /** 基準距離に対する倍数（小数1桁）。 */
  value: number;
  /** 倍数の後ろに付ける単位（往復・周回・縦断の回数）。比較対象ごとに固定。 */
  unit: DistanceComparisonUnit;
  /** 2地点間の比較のときの両端の地名。周回（日本・地球）は null。 */
  endpoints: [string, string] | null;
};

/** 距離の段階（1が最も短い）。 */
export type DistanceTier = 1 | 2 | 3 | 4;

/**
 * 比較対象の定義。表示用の `DistanceComparison` から倍数を除き、倍数の計算に使う基準距離（メートル）を持つ。
 * 往復の比較対象は、片道の距離の2倍を基準距離にしている。
 */
type ComparisonTarget = Omit<DistanceComparison, 'value'> & { baseMeters: number };

/** 比較対象の一覧。基準距離の大きい順に並べ、最初に1以上になるものを採用する（spec §4.1）。 */
const COMPARISON_TARGETS: readonly ComparisonTarget[] = [
  { label: '地球〜太陽', baseMeters: 299_200_000_000, unit: '往復分', endpoints: ['地球', '太陽'] },
  { label: '地球〜火星', baseMeters: 112_000_000_000, unit: '往復分', endpoints: ['地球', '火星'] },
  { label: '地球〜月', baseMeters: 768_800_000, unit: '往復分', endpoints: ['地球', '月'] },
  { label: '地球', baseMeters: 40_075_000, unit: '周分', endpoints: null },
  { label: '日本', baseMeters: 12_000_000, unit: '周分', endpoints: null },
  { label: '日本縦断', baseMeters: 3_000_000, unit: '回分', endpoints: ['宗谷岬', '佐多岬'] },
  { label: '東京〜大阪', baseMeters: 1_000_000, unit: '往復分', endpoints: ['東京', '大阪'] },
];

/** 小数1桁に丸める。 */
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 総移動距離を、1以上になる最大の比較対象で表す。
 * どれも1未満（1,000km未満）のときは東京〜大阪の小数にする。
 */
export function resolveDistanceComparison(totalMeters: number): DistanceComparison {
  const fallback = COMPARISON_TARGETS[COMPARISON_TARGETS.length - 1];
  const target = COMPARISON_TARGETS.find((candidate) => totalMeters >= candidate.baseMeters) ?? fallback;
  const { baseMeters, ...rest } = target;
  return { ...rest, value: roundToOneDecimal(totalMeters / baseMeters) };
}

/** 広さの比較で倍数の後ろに付ける単位。地域・皇居は「倍」、東京ドームは「個分」、サッカーコートは「面分」。 */
export type AreaComparisonSuffix = '倍' | '個分' | '面分';

/** ページ8に表示する、新しく塗ったエリアの広さの比較結果。 */
export type AreaComparison = {
  /** 比較対象の名前（例: `皇居`、`東京ドーム`）。 */
  label: string;
  /** 基準面積に対する倍数。10以上は整数、10未満は小数1桁。 */
  value: number;
  /** 倍数の後ろに付ける単位。 */
  suffix: AreaComparisonSuffix;
};

/** 広さの比較対象の定義。倍数の計算に使う基準面積（m²）を持つ。 */
type AreaComparisonTarget = Omit<AreaComparison, 'value'> & { baseSquareMeters: number };

/**
 * 広さの比較対象の一覧。基準面積の大きい順に並べ、最初に1以上になるものを採用する。
 * 東京23区（約627km²）は琵琶湖（約669km²）とほぼ同じ広さで段階が増えるだけのため載せない。
 */
const AREA_COMPARISON_TARGETS: readonly AreaComparisonTarget[] = [
  { label: '四国', baseSquareMeters: 18_800_000_000, suffix: '倍' },
  { label: '東京都', baseSquareMeters: 2_194_000_000, suffix: '倍' },
  { label: '琵琶湖', baseSquareMeters: 669_000_000, suffix: '倍' },
  { label: '山手線の内側', baseSquareMeters: 63_000_000, suffix: '倍' },
  { label: '皇居', baseSquareMeters: 1_150_000, suffix: '倍' },
  { label: '東京ドーム', baseSquareMeters: 46_755, suffix: '個分' },
  { label: 'サッカーコート', baseSquareMeters: 7_140, suffix: '面分' },
];

/** 古い保存データの面積概算に使う、緯度35°付近の100mセル1件の地表面積（m²）。 */
const FALLBACK_SQUARE_METERS_PER_CELL = 6_700;

/** 倍数を表示用に丸める。10以上は整数、10未満は小数1桁にして、大きい数の細かい端数を見せない。 */
function roundAreaRatio(ratio: number): number {
  return ratio >= 10 ? Math.round(ratio) : roundToOneDecimal(ratio);
}

/**
 * 面積（m²）を、1以上になる最大の比較対象で表す。
 * どれも1未満（サッカーコート1面未満）のときはサッカーコートの小数にする。0でも例外にしない。
 */
export function resolveAreaComparison(squareMeters: number): AreaComparison {
  const fallback = AREA_COMPARISON_TARGETS[AREA_COMPARISON_TARGETS.length - 1];
  const target = AREA_COMPARISON_TARGETS.find((candidate) => squareMeters >= candidate.baseSquareMeters) ?? fallback;
  const { baseSquareMeters, ...rest } = target;
  return { ...rest, value: roundAreaRatio(squareMeters / baseSquareMeters) };
}

/** 広さの比較を「皇居の約2.8倍」「東京ドーム 約12個分」「サッカーコート 約0.3面分」の形にする。 */
export function formatAreaComparison(comparison: AreaComparison): string {
  if (comparison.suffix === '倍') {
    return `${comparison.label}の約${comparison.value}倍`;
  }
  return `${comparison.label} 約${comparison.value}${comparison.suffix}`;
}

/**
 * 新しく塗ったエリアの面積（m²）を返す。
 * 実面積を保存する前の古いデータには `newAreaSquareMeters` が無いため、日本付近（緯度35°）の1マスの広さで概算する。
 */
export function resolveNewAreaSquareMeters(payload: { newCellCount: number; newAreaSquareMeters?: number }): number {
  return payload.newAreaSquareMeters ?? payload.newCellCount * FALLBACK_SQUARE_METERS_PER_CELL;
}

/** 整数を3桁区切りの文字列にする。端末のロケール設定に左右されないよう自前で区切る。 */
function withThousandsSeparator(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 面積（m²）を、比較の一文の下に添える大きさの表記にする。
 * 100km²以上は整数のkm²、0.1km²以上は小数1桁のkm²、それより狭いときはm²を千の位で丸める（最小は約1,000m²）。
 */
export function formatAreaSize(squareMeters: number): string {
  const squareKilometers = squareMeters / 1_000_000;
  if (squareKilometers >= 100) {
    return `約${withThousandsSeparator(Math.round(squareKilometers))}km²`;
  }
  if (squareKilometers >= 0.1) {
    return `約${squareKilometers.toFixed(1)}km²`;
  }
  return `約${withThousandsSeparator(Math.max(1, Math.round(squareMeters / 1_000)) * 1_000)}m²`;
}

/** 年間距離から段階を決める。境目（3,000km / 10,000km / 25,000km）ちょうどは上の段階。 */
export function resolveDistanceTier(totalMeters: number): DistanceTier {
  if (totalMeters >= 25_000_000) return 4;
  if (totalMeters >= 10_000_000) return 3;
  if (totalMeters >= 3_000_000) return 2;
  return 1;
}

/** ページ4（1年の移動マップ）の段階別メッセージ。 */
export function mapPageMessage(tier: DistanceTier): string {
  switch (tier) {
    case 1:
      return 'このエリアを移動しました！';
    case 2:
      return 'いろんなところに行きましたね！';
    case 3:
      return '旅行が多い一年でしたね！';
    case 4:
      return 'めちゃくちゃ移動しましたね！';
  }
}

/** ページ10（まとめ）の段階別メッセージ。「今年」は使わず年を数字で書く。 */
export function summaryMessage(tier: DistanceTier, year: number): string {
  switch (tier) {
    case 1:
      return 'いろいろなところに行きましたね！';
    case 2:
      return `${year}年もいっぱい移動しましたね！`;
    case 3:
      return '旅行が多い一年でした！';
    case 4:
      return 'フットワークの軽い一年でした！';
  }
}

/** ページ9のメイン文言。スポットが0件のときは実績のみの文言にする。 */
export function achievementMessage(achievementCount: number, spotCount: number): string {
  if (spotCount > 0) {
    return `${achievementCount}個の実績解除と、${spotCount}か所のスポットに到達しました！`;
  }
  return `${achievementCount}個の実績を解除しました！`;
}
