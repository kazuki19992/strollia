import { BlurView, type BlurTint } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

/** GradientBlurOverlay のprops。 */
export type GradientBlurOverlayProps = {
  /** ぼかしを始める位置(親の上端からのpt)。これより上はぼかさない。 */
  gradientTop: number;
  /** ぼかしを段階的に強めていく区間の高さ(pt)。 */
  gradientHeight: number;
  /** 最大のぼかしの強さ。グラデーション区間の最後の帯と、その下の全体に使う。既定は90。 */
  maxIntensity?: number;
  /** グラデーション区間を分割する帯の本数。多いほど滑らかになる。既定は16。 */
  steps?: number;
  /** BlurView の色味。ライト/ダークテーマに合わせて呼び出し側が渡す。 */
  tint: BlurTint;
  /**
   * ぼかしの上から重ねて段階的に濃くしていく色。通常は画面の背景色を渡す。
   * BlurView の色味が背景とわずかに違い、ぼかした範囲が箱のように見えるのを背景へ溶け込ませるため。省略時は重ねない。
   */
  fadeColor?: string;
  /** fadeColor の最大の不透明度。グラデーション区間の最後の帯と、その下の全体に使う。既定は0.85。 */
  maxFadeOpacity?: number;
};

/**
 * 親の上に絶対配置で重ね、上から下へ向けてだんだん強くなるぼかしを描く。
 *
 * expo-blur には段階的なぼかしがないため、強さの違う BlurView を細い帯状に縦へ並べて近似する。
 * 弱いぼかしでも帯の境目が目立つため、強さは二次曲線で序盤ほどゆるやかに上げる。
 * グラデーション区間より下は最大の強さの BlurView 1枚で下端まで覆う。
 * ぼかし自体はタッチを受け付けず(`pointerEvents="none"`)下の要素へ通すため、
 * ぼかした内容を押させたくない場合は、呼び出し側で対象の要素自体を押せない状態にしておくこと。
 */
export function GradientBlurOverlay({
  gradientTop,
  gradientHeight,
  maxIntensity = 90,
  steps = 16,
  tint,
  fadeColor,
  maxFadeOpacity = 0.85,
}: GradientBlurOverlayProps) {
  const bandHeight = gradientHeight / steps;
  const bandIndexes = Array.from({ length: steps }, (_, index) => index);
  const bandStyle = (index: number) => ({
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: gradientTop + bandHeight * index,
    height: bandHeight,
  });
  const restStyle = { position: 'absolute' as const, left: 0, right: 0, top: gradientTop + gradientHeight, bottom: 0 };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bandIndexes.map((index) => (
        <BlurView key={`blur-${index}`} intensity={maxIntensity * ((index + 1) / steps) ** 2} style={bandStyle(index)} tint={tint} />
      ))}
      <BlurView intensity={maxIntensity} style={restStyle} tint={tint} />
      {fadeColor ? (
        <>
          {bandIndexes.map((index) => (
            <View
              key={`fade-${index}`}
              style={{ ...bandStyle(index), backgroundColor: fadeColor, opacity: (maxFadeOpacity * (index + 1)) / steps }}
            />
          ))}
          <View style={{ ...restStyle, backgroundColor: fadeColor, opacity: maxFadeOpacity }} />
        </>
      ) : null}
    </View>
  );
}
