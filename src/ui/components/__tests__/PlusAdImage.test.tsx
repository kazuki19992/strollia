import { View } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';

import { PlusAdImage, PLUS_AD_IMAGE_ASPECT_RATIO } from '@/ui/components/PlusAdImage';

describe('PlusAdImage', () => {
  test('PNG広告画像を枠幅に合わせた数値サイズで表示する', () => {
    render(<PlusAdImage accessibilityLabel="Strollia Plusの機能比較広告" width="100%" />);

    // View の onLayout を持つ外枠フレームを UNSAFE_getAllByType で取得する
    // width スタイルプロパティや onLayout という非セマンティックな props の検証のため UNSAFE を使う
    const frame = screen.UNSAFE_getAllByType(View).find((node) => node.props.onLayout && node.props.style?.width === '100%');
    expect(frame).toBeTruthy();
    expect(frame!.props.style).toEqual(expect.objectContaining({ width: '100%' }));

    act(() => {
      frame!.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
    });

    const image = screen.getByLabelText('Strollia Plusの機能比較広告');
    expect(image.props.resizeMode).toBe('contain');
    expect(image.props.style).toEqual([
      expect.objectContaining({ resizeMode: 'contain' }),
      { width: 320, height: 320 / PLUS_AD_IMAGE_ASPECT_RATIO },
    ]);
  });
});
