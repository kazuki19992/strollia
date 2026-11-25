import { Easing } from 'react-native';

import type { AnnualReportPayloadV1 } from '@/features/annualReport/annualReportTypes';

/** 年間レポートの各ページに共通の props。 */
export type AnnualReportPageProps = {
  /** 表示するレポート。 */
  payload: AnnualReportPayloadV1;
  /** ページ内アニメーションを止めるか(長押し・共有確認中・アプリ背面化)。 */
  paused: boolean;
  /** true のときページ内アニメーションを完成状態へ飛ばす(共有画像を撮るとき)。 */
  completed: boolean;
  /** 本文の上端(セーフエリア上端＋進行バー・ヘッダーの高さ)。 */
  contentTop: number;
  /** 本文の下端の余白(セーフエリア下端＋共有ボタンの高さ)。 */
  contentBottom: number;
};

/** 本文の段階的な出現の遅延(ミリ秒)。デモの d1〜d5 に合わせる。 */
export const RISE_DELAYS_MS = [0, 300, 900, 1500, 2100, 2700] as const;

/** 出現・伸びのイージング(cubic-bezier(.2,.8,.2,1))。 */
export const RISE_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);

/** カウントアップのイージング(1-(1-k)^3)。 */
export const COUNT_UP_EASING = (value: number) => 1 - Math.pow(1 - value, 3);

/** 0〜1 にクランプする。 */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 時計の値から、開始時刻と長さで決まるカウントアップ値を返す。 */
export function countUpValue(elapsedMs: number, startMs: number, durationMs: number, target: number): number {
  return target * COUNT_UP_EASING(clamp01((elapsedMs - startMs) / durationMs));
}
