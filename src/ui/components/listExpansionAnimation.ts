import { LayoutAnimation } from 'react-native';

/** リストの開閉アニメーションの長さ(ミリ秒)。 */
export const LIST_EXPANSION_DURATION_MS = 250;

/**
 * リストの行を開閉して表示内容が増減する直前に呼ぶと、次のレイアウト変化を標準のトランジションでアニメーションする。
 *
 * 追加・削除される行はフェードし、下の行の位置の変化は ease-in-out で補間する。
 * 開閉の state 更新の「直前」に呼ぶこと(呼んだ後に setState する)。`Dialog.tsx` の `animateDialogResize` と同じ方式で、
 * 依存を増やさず標準の LayoutAnimation だけで済ませている。
 */
export function animateListExpansion(): void {
  LayoutAnimation.configureNext({
    duration: LIST_EXPANSION_DURATION_MS,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}
