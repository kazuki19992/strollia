/**
 * Native Modalを保持したまま再生する共通退場トランジションの時間。
 *
 * 次のグローバルモーダルを開く側も、先行モーダルのNative層が消えるまでこの時間を待機する。
 */
export const MODAL_EXIT_TRANSITION_DURATION_MS = 500;

/** Native Modalの退場完了通知と実際のアンマウントの競合を避ける追加待機時間。 */
export const MODAL_EXIT_SETTLE_BUFFER_MS = 100;
