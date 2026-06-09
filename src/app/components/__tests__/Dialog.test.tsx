import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { createStyles } from '../../appStyles';
import { lightTheme } from '../../../theme/theme';
import { Dialog } from '../Dialog';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text, MaterialCommunityIcons: Text };
});

const mockConfetti = jest.fn();
jest.mock('../ConfettiOverlay', () => ({
  ConfettiOverlay: (props: Record<string, unknown>) => {
    mockConfetti(props);
    return null;
  },
}));

const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void) => void;
  create: (element: ReactNode) => { root: any; unmount: () => void };
};

const styles = createStyles(lightTheme);

let renderer: { root: any; unmount: () => void } | null = null;

describe('汎用ダイアログ Dialog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockConfetti.mockClear();
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    jest.useRealTimers();
  });

  test('autoClose=true のとき10秒経過で onClose を呼ぶ', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <Dialog visible autoClose animationKey="k1" styles={styles} theme={lightTheme} onClose={onClose}>
          <Text>本文</Text>
        </Dialog>,
      );
    });

    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('autoClose=false のときは時間経過しても onClose を呼ばない', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <Dialog visible styles={styles} theme={lightTheme} onClose={onClose}>
          <Text>本文</Text>
        </Dialog>,
      );
    });

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('showConfetti=false のとき ConfettiOverlay を active=false で描画する', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <Dialog visible styles={styles} theme={lightTheme} onClose={onClose}>
          <Text>本文</Text>
        </Dialog>,
      );
    });

    expect(mockConfetti).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  test('閉じるボタンを押すと onClose を呼ぶ', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <Dialog visible styles={styles} theme={lightTheme} onClose={onClose}>
          <Text>本文</Text>
        </Dialog>,
      );
    });

    const closeButton = renderer!.root.findByProps({ accessibilityLabel: '閉じる' });
    act(() => {
      closeButton.props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('render-prop の pauseAutoClose を呼ぶと自動クローズが止まる', () => {
    const onClose = jest.fn();
    act(() => {
      renderer = create(
        <Dialog visible autoClose styles={styles} theme={lightTheme} onClose={onClose}>
          {({ pauseAutoClose }) => (
            <Text accessibilityLabel="pause" onPress={pauseAutoClose}>
              共有
            </Text>
          )}
        </Dialog>,
      );
    });

    const pauseNode = renderer!.root.findByProps({ accessibilityLabel: 'pause' });
    act(() => {
      pauseNode.props.onPress();
    });
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
