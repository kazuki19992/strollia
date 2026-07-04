import type { ReactNode } from 'react';
import { Image, View } from 'react-native';

import { PlusAdImage, PLUS_AD_IMAGE_ASPECT_RATIO } from '@/app/components/PlusAdImage';

const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void) => void;
  create: (element: ReactNode) => { root: any; unmount: () => void };
};

let renderer: { root: any; unmount: () => void } | null = null;

describe('PlusAdImage', () => {
  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
  });

  test('PNG広告画像を枠幅に合わせた数値サイズで表示する', () => {
    act(() => {
      renderer = create(<PlusAdImage accessibilityLabel="Strollia Plusの機能比較広告" width="100%" />);
    });

    const frame = renderer!.root.findByType(View);
    expect(frame.props.style).toEqual(expect.objectContaining({ width: '100%' }));

    act(() => {
      frame.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
    });

    const image = renderer!.root.findByType(Image);
    expect(image.props.accessibilityLabel).toBe('Strollia Plusの機能比較広告');
    expect(image.props.resizeMode).toBe('contain');
    expect(image.props.style).toEqual([
      expect.objectContaining({ resizeMode: 'contain' }),
      { width: 320, height: 320 / PLUS_AD_IMAGE_ASPECT_RATIO },
    ]);
  });
});
