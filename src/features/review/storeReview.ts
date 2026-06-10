import * as StoreReview from 'expo-store-review';

/**
 * 利用可能ならシステム標準のApp Storeレビュー促進ダイアログを要求する。
 *
 * 実際の表示頻度はOSが制御するため、呼び出しても必ず表示されるとは限らない。
 *
 * @returns レビュー要求の完了を表すPromise。
 */
export async function requestStoreReview(): Promise<void> {
  if (!(await StoreReview.isAvailableAsync())) {
    return;
  }

  await StoreReview.requestReview();
}
