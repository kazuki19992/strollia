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
  /** 表示領域の最大幅。最大高と合わせてcontain相当の寸法を決める。 */
  maxWidth?: number;
  /** 表示領域の最大高。最大幅と合わせてcontain相当の寸法を決める。 */
  maxHeight?: number;
  /** SVGプリミティブ、またはSVGプリミティブを返すコンポーネント。 */
  children: ReactNode;
  /** テストや自動化で参照する識別子。 */
  testID?: string;
};

/** 固定viewBoxのSVG要素を親幅いっぱいに縦横比を保って描画する。viewBoxの幅・高さは正数を指定する。 */
export function ScalableSvgCanvas({
  viewBoxWidth,
  viewBoxHeight,
  accessibilityLabel,
  maxWidth,
  maxHeight,
  children,
  testID,
}: ScalableSvgCanvasProps): ReactElement {
  const hasValidViewBox = viewBoxWidth > 0 && viewBoxHeight > 0;
  const widthScale = !hasValidViewBox || maxWidth === undefined ? Number.POSITIVE_INFINITY : Math.max(0, maxWidth) / viewBoxWidth;
  const heightScale = !hasValidViewBox || maxHeight === undefined ? Number.POSITIVE_INFINITY : Math.max(0, maxHeight) / viewBoxHeight;
  const containedScale = Math.min(widthScale, heightScale);
  const containerStyle = !hasValidViewBox
    ? { alignSelf: 'center' as const, width: 0, height: 0 }
    : Number.isFinite(containedScale)
      ? { alignSelf: 'center' as const, width: viewBoxWidth * containedScale, height: viewBoxHeight * containedScale }
      : { width: '100%' as const, aspectRatio: viewBoxWidth / viewBoxHeight };

  return (
    <View testID={testID ? `${testID}-container` : undefined} style={containerStyle}>
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
