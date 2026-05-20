import * as Font from 'expo-font';

/** DSEG7 Classic Bold Italicのフォントファミリー名。 */
export const DSEG7_CLASSIC_BOLD_ITALIC_FONT = 'DSEG7Classic-BoldItalic';

/** 数値を7セグ風に見せたい箇所で使う標準フォント。 */
export const NUMERIC_DISPLAY_FONT = DSEG7_CLASSIC_BOLD_ITALIC_FONT;

/**
 * アプリ内で使うカスタムフォントを読み込む。
 *
 * @returns フォント読み込み完了を表すPromise。
 */
export async function loadAppFonts(): Promise<void> {
  await Font.loadAsync({
    [DSEG7_CLASSIC_BOLD_ITALIC_FONT]: require('../../assets/fonts/DSEG7Classic-BoldItalic.ttf'),
  });
}
