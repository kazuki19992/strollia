import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';
import Svg from 'react-native-svg';

/** 固定viewBoxのSVGを親幅に合わせて均等に拡大縮小するためのプロパティ。 */
export type ScalableSvgCanvasProps = {
  /** SVGのviewBoxにおける幅。 */
  viewBoxWidth: number;
  /** SVGのviewBoxにおける高さ。 */
  viewBoxHeight: number;
  /** SVG全体に設定する読み上げラベル。 */
  accessibilityLabel: string;
  /** SVGプリミティブ、またはSVGプリミティブを返すコンポーネント。 */
  children: ReactNode;
  /** テストや自動化で参照する識別子。 */
  testID?: string;
};

/** 固定viewBoxのSVG要素を親幅いっぱいに縦横比を保って描画する。 */
export function ScalableSvgCanvas({
  viewBoxWidth,
  viewBoxHeight,
  accessibilityLabel,
  children,
  testID,
}: ScalableSvgCanvasProps): ReactElement {
  return (
    <View testID={testID ? `${testID}-container` : undefined} style={{ width: '100%', aspectRatio: viewBoxWidth / viewBoxHeight }}>
      <Svg
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {children}
      </Svg>
    </View>
  );
}
