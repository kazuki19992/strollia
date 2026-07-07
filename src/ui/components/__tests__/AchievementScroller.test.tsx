import { Image, Text } from 'react-native';

import { AchievementScroller } from '@/ui/components/AchievementScroller';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy({}, { get: (_target, prop) => prop });

describe('実績スクローラー AchievementScroller', () => {
  test('実績画像を読み上げ可能な画像として表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <AchievementScroller
          achievements={[
            {
              id: 'distance-100',
              title: '100km移動した',
              unlockedAt: '2026-05-31T09:00:00.000Z',
              trophyImage: { uri: 'badge.png' },
            },
          ]}
          styles={styles as never}
        />,
      );
    });

    const image = renderer.root.findByType(Image);

    expect(image.props.accessibilityLabel).toBe('100km移動したの実績画像');
    expect(image.props.accessibilityRole).toBe('image');
  });

  test('実績がない場合は空状態を表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<AchievementScroller achievements={[]} styles={styles as never} />);
    });

    expect(renderer.root.findByType(Text).props.children).toBe('この日に獲得した実績はありません。');
  });
});
