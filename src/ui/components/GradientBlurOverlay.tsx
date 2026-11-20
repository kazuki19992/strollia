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
  /** グラデーション区間を分割する帯の本数。多いほど滑らかになる。既定は8。 */
  steps?: number;
  /** BlurView の色味。ライト/ダークテーマに合わせて呼び出し側が渡す。 */
  tint: BlurTint;
};

/**
 * 親の上に絶対配置で重ね、上から下へ向けてだんだん強くなるぼかしを描く。
 *
 * expo-blur には段階的なぼかしがないため、強さの違う BlurView を細い帯状に縦へ並べて近似する。
 * グラデーション区間より下は最大の強さの BlurView 1枚で下端まで覆う。
 * ぼかし自体はタッチを受け付けず(`pointerEvents="none"`)下の要素へ通すため、
 * ぼかした内容を押させたくない場合は、呼び出し側で対象の要素自体を押せない状態にしておくこと。
 */
export function GradientBlurOverlay({ gradientTop, gradientHeight, maxIntensity = 90, steps = 8, tint }: GradientBlurOverlayProps) {
  const bandHeight = gradientHeight / steps;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: steps }, (_, index) => (
        <BlurView
          key={index}
          intensity={(maxIntensity * (index + 1)) / steps}
          style={{ position: 'absolute', left: 0, right: 0, top: gradientTop + bandHeight * index, height: bandHeight }}
          tint={tint}
        />
      ))}
      <BlurView
        intensity={maxIntensity}
        style={{ position: 'absolute', left: 0, right: 0, top: gradientTop + gradientHeight, bottom: 0 }}
        tint={tint}
      />
    </View>
  );
}
