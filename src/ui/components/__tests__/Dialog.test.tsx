import { PanResponder, Platform, Text } from 'react-native';
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

/** 直近に Modal へ渡された props。閉じた後(visible=false)の onDismiss を呼ぶために控える。 */
let mockLastModalProps: { onDismiss?: () => void } = {};
// RN 標準の jest モックは visible=false で要素ごと消え、onDismiss を呼べないため、props を控える Modal に差し替える
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const { View } = require('react-native');
  function MockModal(props: { visible?: boolean; children?: unknown; onDismiss?: () => void }) {
    mockLastModalProps = props;
    return props.visible ? <View>{props.children as never}</View> : null;
  }
  return { __esModule: true, default: MockModal };
});

const styles = createStyles(lightTheme);

describe('汎用ダイアログ Dialog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockConfetti.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('autoClose=true のとき10秒経過で onClose を呼ぶ', async () => {
    const onClose = jest.fn();
    await render(
      <Dialog visible autoClose animationKey="k1" styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    expect(onClose).not.toHaveBeenCalled();
    await act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('autoClose=false のときは時間経過しても onClose を呼ばない', async () => {
    const onClose = jest.fn();
    await render(
      <Dialog visible styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    await act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('showConfetti=false のとき ConfettiOverlay を active=false で描画する', async () => {
    const onClose = jest.fn();
    await render(
      <Dialog visible styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    expect(mockConfetti).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });

  test('閉じるボタンを押すと onClose を呼ぶ', async () => {
    const onClose = jest.fn();
    await render(
      <Dialog visible styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('閉じる'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('swipeToClose 既定時はスワイプヒントを表示する', async () => {
    const onClose = jest.fn();
    await render(
      <Dialog visible styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    expect(screen.getByText('スワイプで閉じる')).toBeTruthy();
  });

  test('swipeToClose=false のときヒントを表示しない', async () => {
    const onClose = jest.fn();
    await render(
      <Dialog visible swipeToClose={false} styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    expect(screen.queryByText('スワイプで閉じる')).toBeNull();
  });

  test('swipeToClose=false のときスワイプ追従用のPanResponderを作らない', async () => {
    const createSpy = jest.spyOn(PanResponder, 'create');
    const onClose = jest.fn();

    await render(
      <Dialog visible swipeToClose={false} styles={styles} onClose={onClose}>
        <Text>本文</Text>
      </Dialog>,
    );

    expect(createSpy).not.toHaveBeenCalled();
  });

  test('render-prop の pauseAutoClose を呼ぶと自動クローズが止まる', async () => {
    const onClose = jest.fn();
    await render(
      <Dialog visible autoClose styles={styles} onClose={onClose}>
        {({ pauseAutoClose }) => (
          <Text accessibilityLabel="pause" onPress={pauseAutoClose}>
            共有
          </Text>
        )}
      </Dialog>,
    );

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('pause'));
    });
    await act(() => {
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

  it('dismissible=false のとき閉じるボタンを描画しない', async () => {
    await render(
      <Dialog visible dismissible={false} swipeToClose={false} styles={styles} onClose={() => undefined}>
        <Text>本文</Text>
      </Dialog>,
    );
    expect(screen.queryByLabelText('閉じる')).toBeNull();
  });

  it('dismissible 既定（true）では閉じるボタンを描画する', async () => {
    await render(
      <Dialog visible swipeToClose={false} styles={styles} onClose={() => undefined}>
        <Text>本文</Text>
      </Dialog>,
    );
    expect(screen.getByLabelText('閉じる')).toBeTruthy();
  });
});

describe('Dialog onExited', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /** 表示中のダイアログを親から閉じ、退場アニメーションを流し切る。 */
  async function closeFromParent(onExited: () => void) {
    const view = (visible: boolean) => (
      <Dialog visible={visible} styles={styles} onClose={() => undefined} onExited={onExited}>
        <Text>本文</Text>
      </Dialog>
    );
    const { rerender } = await render(view(true));
    await rerender(view(false));
    // 退場アニメーション(500ms)だけを流し切る
    await act(() => {
      jest.advanceTimersByTime(600);
    });
  }

  it('iOS では Modal が閉じきった通知(onDismiss)を受けてから onExited を1回呼ぶ', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const onExited = jest.fn();
    await closeFromParent(onExited);

    // 退場アニメーションが終わっただけでは、ネイティブの Modal がまだ閉じきっていない
    expect(onExited).not.toHaveBeenCalled();

    // ネイティブの Modal が閉じきったときの通知を再現する
    await act(() => {
      mockLastModalProps.onDismiss?.();
    });

    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it('iOS で onDismiss が届かなくても、Modal を外してから一定時間後に onExited を1回だけ呼ぶ', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const onExited = jest.fn();
    await closeFromParent(onExited);
    expect(onExited).not.toHaveBeenCalled();

    await act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(onExited).toHaveBeenCalledTimes(1);

    // 遅れて onDismiss が届いても二重には呼ばない
    await act(() => {
      mockLastModalProps.onDismiss?.();
    });
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it('iOS で onDismiss が先に届いたら、一定時間後に重ねて呼ばない', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const onExited = jest.fn();
    await closeFromParent(onExited);
    await act(() => {
      mockLastModalProps.onDismiss?.();
    });
    await act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it('Android では退場アニメーションが終わって Modal を外したら onExited を1回呼ぶ', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const onExited = jest.fn();
    await closeFromParent(onExited);

    expect(onExited).toHaveBeenCalledTimes(1);
  });
});
