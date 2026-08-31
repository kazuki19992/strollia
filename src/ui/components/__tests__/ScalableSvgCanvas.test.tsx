import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { Rect } from 'react-native-svg';

import { ScalableSvgCanvas } from '@/ui/components/ScalableSvgCanvas';

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: View,
    Rect: View,
  };
});

describe('拡大縮小可能なSVGキャンバス ScalableSvgCanvas', () => {
  test('固定viewBoxと縦横比を保ち、SVGの子要素と読み上げラベルを描画する', () => {
    render(
      <ScalableSvgCanvas viewBoxWidth={329} viewBoxHeight={261} accessibilityLabel="更新通知" testID="vector-canvas">
        <Rect testID="vector-child" x={0} y={0} width={10} height={10} />
      </ScalableSvgCanvas>,
    );

    expect(screen.getByTestId('vector-canvas-container').props.style).toEqual(
      expect.objectContaining({ width: '100%', aspectRatio: 329 / 261 }),
    );
    expect(screen.getByTestId('vector-canvas')).toHaveProp('viewBox', '0 0 329 261');
    expect(screen.getByTestId('vector-canvas')).toHaveProp('preserveAspectRatio', 'xMidYMid meet');
    expect(screen.getByLabelText('更新通知')).toBeTruthy();
    expect(screen.getByTestId('vector-child')).toBeTruthy();
  });

  test('表示幅が80%になっても同じ縦横比でviewBox全体を線形縮小する', () => {
    const renderAtWidth = (width: number) => (
      <View testID="vector-display-area" style={{ width }}>
        <ScalableSvgCanvas viewBoxWidth={329} viewBoxHeight={261} accessibilityLabel="更新通知" testID="vector-canvas">
          <Rect testID="vector-child" x={0} y={0} width={329} height={261} />
        </ScalableSvgCanvas>
      </View>
    );
    const { rerender } = render(renderAtWidth(329));

    const baseAspectRatio = screen.getByTestId('vector-canvas-container').props.style.aspectRatio;
    expect(screen.getByTestId('vector-display-area').props.style.width).toBe(329);
    expect(baseAspectRatio).toBe(329 / 261);
    expect(329 / baseAspectRatio).toBeCloseTo(261);

    rerender(renderAtWidth(263.2));

    const scaledAspectRatio = screen.getByTestId('vector-canvas-container').props.style.aspectRatio;
    expect(screen.getByTestId('vector-display-area').props.style.width).toBe(263.2);
    expect(scaledAspectRatio).toBe(baseAspectRatio);
    expect(263.2 / scaledAspectRatio).toBeCloseTo(208.8);
    expect(screen.getByTestId('vector-canvas')).toHaveProp('viewBox', '0 0 329 261');
    expect(screen.getByTestId('vector-canvas')).toHaveProp('width', '100%');
    expect(screen.getByTestId('vector-canvas')).toHaveProp('height', '100%');
  });

  test('最大幅と最大高の内側へobject-fit contain相当で収める', () => {
    render(
      <ScalableSvgCanvas
        viewBoxWidth={329}
        viewBoxHeight={261}
        maxWidth={263.2}
        maxHeight={180}
        accessibilityLabel="更新通知"
        testID="vector-canvas"
      >
        <Rect testID="vector-child" x={0} y={0} width={329} height={261} />
      </ScalableSvgCanvas>,
    );

    const containerStyle = screen.getByTestId('vector-canvas-container').props.style;
    expect(containerStyle.alignSelf).toBe('center');
    expect(containerStyle.width).toBeCloseTo((180 * 329) / 261);
    expect(containerStyle.height).toBeCloseTo(180);
    expect(screen.getByTestId('vector-canvas')).toHaveProp('preserveAspectRatio', 'xMidYMid meet');
  });

  test('viewBoxの幅または高さが0でもNaN寸法を描画しない', () => {
    render(
      <ScalableSvgCanvas
        viewBoxWidth={0}
        viewBoxHeight={0}
        maxWidth={200}
        maxHeight={200}
        accessibilityLabel="無効なSVG"
        testID="invalid-canvas"
      >
        <Rect />
      </ScalableSvgCanvas>,
    );

    expect(screen.getByTestId('invalid-canvas-container').props.style).toEqual({ alignSelf: 'center', width: 0, height: 0 });
  });
});
