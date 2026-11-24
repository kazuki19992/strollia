/** 距離比較の単位。 */
export type DistanceComparisonUnit = '往復分' | '周分' | '回分';

/** ページ3に表示する、総移動距離の比較結果。 */
export type DistanceComparison = {
  /** 比較対象の表記（例: `東京〜大阪`、`地球`）。 */
  label: string;
  /** 基準距離に対する倍数（小数1桁）。 */
  value: number;
  unit: DistanceComparisonUnit;
  /** 2地点間の比較のときの両端の地名。周回（日本・地球）は null。 */
  endpoints: [string, string] | null;
};

/** 距離の段階（1が最も短い）。 */
export type DistanceTier = 1 | 2 | 3 | 4;

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
