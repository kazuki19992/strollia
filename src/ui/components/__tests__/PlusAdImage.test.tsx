import { fireEvent, render, screen } from '@testing-library/react-native';

import { PlusAdImage, PLUS_AD_IMAGE_ASPECT_RATIO } from '@/ui/components/PlusAdImage';

describe('PlusAdImage', () => {
  test('PNG広告画像を枠幅に合わせた数値サイズで表示する', async () => {
    await render(<PlusAdImage accessibilityLabel="Strollia Plusの機能比較広告" width="100%" />);

    // View の onLayout を持つ外枠フレームを container の host View から取得する
    // width スタイルプロパティや onLayout という非セマンティックな props の検証のため container を使う
    const frame = screen.container.queryAll((node) => node.type === 'View' && node.props.onLayout && node.props.style?.width === '100%')[0];
    expect(frame).toBeTruthy();
    expect(frame!.props.style).toEqual(expect.objectContaining({ width: '100%' }));

    await fireEvent(frame!, 'layout', { nativeEvent: { layout: { width: 320 } } });

    const image = screen.getByLabelText('Strollia Plusの機能比較広告');
    expect(image.props.resizeMode).toBe('contain');
    expect(image.props.style).toEqual([
      expect.objectContaining({ resizeMode: 'contain' }),
      { width: 320, height: 320 / PLUS_AD_IMAGE_ASPECT_RATIO },
    ]);
  });
});
