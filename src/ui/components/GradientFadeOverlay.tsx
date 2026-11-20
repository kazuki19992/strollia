import { StyleSheet, View } from 'react-native';

/** GradientFadeOverlay のprops。 */
export type GradientFadeOverlayProps = {
  /** 重ねる色。通常は画面の背景色を渡し、下の内容を背景へ溶け込ませる。 */
  color: string;
  /** グラデーションを始める位置(親の上端からのpt)。これより上は何も重ねない。 */
  gradientTop: number;
  /** 不透明度を段階的に上げていく区間の高さ(pt)。 */
  gradientHeight: number;
  /**
   * 最大の不透明度。グラデーション区間の最後の帯と、その下の全体に使う。
   * 既定は1で、グラデーション区間より下の内容は完全に隠れる。うっすら見せたい場合だけ1未満にする。
   */
  maxOpacity?: number;
  /** グラデーション区間を分割する帯の本数。多いほど滑らかになる。既定は16。 */
  steps?: number;
};

/**
 * 親の上に絶対配置で重ね、上から下へ向けてだんだん濃くなる色を描く。
 *
 * グラデーション描画の依存を増やさないため、不透明度の違う View を細い帯状に縦へ並べて近似する。
 * グラデーション区間より下は最大の不透明度の View 1枚で下端まで覆う。
 * 重ねた色自体はタッチを受け付けず(`pointerEvents="none"`)下の要素へ通すため、
 * 下の内容を押させたくない場合は、呼び出し側で対象の要素自体を押せない状態にしておくこと。
 */
export function GradientFadeOverlay({ color, gradientTop, gradientHeight, maxOpacity = 1, steps = 16 }: GradientFadeOverlayProps) {
  const bandHeight = gradientHeight / steps;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: steps }, (_, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: gradientTop + bandHeight * index,
            height: bandHeight,
            backgroundColor: color,
            opacity: (maxOpacity * (index + 1)) / steps,
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: gradientTop + gradientHeight,
          bottom: 0,
          backgroundColor: color,
          opacity: maxOpacity,
        }}
      />
    </View>
  );
}
