import { render, screen } from '@testing-library/react-native';
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
});
