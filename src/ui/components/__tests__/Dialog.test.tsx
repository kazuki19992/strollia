import { PanResponder, Text } from 'react-native';
import type { PanResponderCallbacks, PanResponderGestureState } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';
import { Dialog } from '@/ui/components/Dialog';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text, MaterialCommunityIcons: Text };
});

const mockConfetti = jest.fn();
jest.mock('@/ui/components/ConfettiOverlay', () => ({
  ConfettiOverlay: (props: Record<string, unknown>) => {
    mockConfetti(props);
    return null;
  },
}));

const styles = createStyles(lightTheme);

/** PanResponderの方向判定に使うテスト用ジェスチャを作る。 */
function createGestureState(overrides: Partial<PanResponderGestureState> = {}): PanResponderGestureState {
  return {
    stateID: 1,
    moveX: 0,
    moveY: 0,
    x0: 0,
    y0: 0,
    dx: 0,
    dy: 0,
    vx: 0,
    vy: 0,
    numberActiveTouches: 1,
    _accountsForMovesUpTo: 0,
    ...overrides,
  };
}

/** DialogがPanResponderへ渡すコールバックを取得する。 */
function capturePanResponderCallbacks(): { getCallbacks: () => PanResponderCallbacks | null } {
  let callbacks: PanResponderCallbacks | null = null;
  jest.spyOn(PanResponder, 'create').mockImplementation((nextCallbacks) => {
    callbacks = nextCallbacks;
    return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
  });
  return { getCallbacks: () => callbacks };
}

describe('汎用ダイアログ Dialog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockConfetti.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('autoClose=true のとき10秒経過で onClose を呼ぶ', () => {
    const onClose = jest.fn();
    render(
      <Dialog visible autoClose animationKey="k1" styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('autoClose=false のときは時間経過しても onClose を呼ばない', () => {
    const onClose = jest.fn();
    render(
      <Dialog visible styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('showConfetti=false のとき ConfettiOverlay を active=false で描画する', () => {
    const onClose = jest.fn();
    render(
      <Dialog visible styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    expect(mockConfetti).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  test('閉じるボタンを押すと onClose を呼ぶ', () => {
    const onClose = jest.fn();
    render(
      <Dialog visible styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('閉じる'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('swipeToClose 既定時はスワイプヒントを表示する', () => {
    const onClose = jest.fn();
    render(
      <Dialog visible styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    expect(screen.getByText('スワイプで閉じる')).toBeTruthy();
  });

  test('swipeToClose=false のときヒントを表示しない', () => {
    const onClose = jest.fn();
    render(
      <Dialog visible swipeToClose={false} styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    expect(screen.queryByText('スワイプで閉じる')).toBeNull();
  });

  test('swipeToClose=false のときスワイプ追従用のPanResponderを作らない', () => {
    const createSpy = jest.spyOn(PanResponder, 'create');
    const onClose = jest.fn();

    render(
      <Dialog visible swipeToClose={false} styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    expect(createSpy).not.toHaveBeenCalled();
  });

  test('既定の全方向スワイプはタッチ開始時と縦移動でresponderを取得する', () => {
    const { getCallbacks } = capturePanResponderCallbacks();

    render(
      <Dialog visible styles={styles} onClose={() => undefined}>
        <Text>本文</Text>
      </Dialog>,
    );

    const callbacks = getCallbacks();
    const gesture = createGestureState({ dy: 10 });
    expect(callbacks?.onStartShouldSetPanResponder?.(null as never, gesture)).toBe(true);
    expect(callbacks?.onMoveShouldSetPanResponder?.(null as never, gesture)).toBe(true);
  });

  test('水平方向スワイプは縦スクロールにresponderを譲り、水平スワイプでは閉じる', () => {
    const { getCallbacks } = capturePanResponderCallbacks();
    const onClose = jest.fn();

    render(
      <Dialog visible swipeDirection="horizontal" styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    const callbacks = getCallbacks();
    expect(callbacks?.onStartShouldSetPanResponder?.(null as never, createGestureState())).toBe(false);
    expect(callbacks?.onMoveShouldSetPanResponder?.(null as never, createGestureState({ dx: 2, dy: 10 }))).toBe(false);
    expect(callbacks?.onMoveShouldSetPanResponder?.(null as never, createGestureState({ dx: 10, dy: 2 }))).toBe(true);

    act(() => {
      callbacks?.onPanResponderRelease?.(null as never, createGestureState({ dx: 80 }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('render-prop の pauseAutoClose を呼ぶと自動クローズが止まる', () => {
    const onClose = jest.fn();
    render(
      <Dialog visible autoClose styles={styles} onClose={onClose}>
        {({ pauseAutoClose }) => (
          <Text accessibilityLabel="pause" onPress={pauseAutoClose}>
            共有
          </Text>
        )}
      </Dialog>,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('pause'));
    });
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Dialog dismissible', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('dismissible=false のとき閉じるボタンを描画しない', () => {
    render(
      <Dialog visible dismissible={false} swipeToClose={false} styles={styles} onClose={() => undefined}>
        <Text>本文</Text>
      </Dialog>,
    );
    expect(screen.queryByLabelText('閉じる')).toBeNull();
  });

  it('dismissible 既定（true）では閉じるボタンを描画する', () => {
    render(
      <Dialog visible swipeToClose={false} styles={styles} onClose={() => undefined}>
        <Text>本文</Text>
      </Dialog>,
    );
    expect(screen.getByLabelText('閉じる')).toBeTruthy();
  });
});
