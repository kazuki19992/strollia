import { Animated } from 'react-native';
import { useMenuAnimation, MenuAnimationState } from '@/app/hooks/useMenuAnimation';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

type HookProbeProps = {
  isMenuOpen: boolean;
  durationMs: number;
  onState: (state: MenuAnimationState) => void;
};

/** hookが返した状態をテストへ渡すための最小コンポーネント。 */
function HookProbe({ isMenuOpen, durationMs, onState }: HookProbeProps) {
  const state = useMenuAnimation(isMenuOpen, durationMs);
  onState(state);
  return null;
}

describe('メニューアニメーション useMenuAnimation', () => {
  let timingCalls: Array<jest.Mock>;

  beforeEach(() => {
    timingCalls = [];
    jest.spyOn(Animated, 'timing').mockImplementation((() => {
      const animation = { start: jest.fn((cb?: (result: { finished: boolean }) => void) => cb?.({ finished: true })), stop: jest.fn() };
      timingCalls.push(animation.start);
      return animation;
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('初期状態では isMenuVisible=false である', () => {
    let state: MenuAnimationState | undefined;

    act(() => {
      ReactTestRenderer.create(<HookProbe isMenuOpen={false} durationMs={200} onState={(s) => (state = s)} />);
    });

    expect(state!.isMenuVisible).toBe(false);
  });

  it('isMenuOpen=true に変えると isMenuVisible=true になる', () => {
    let state: MenuAnimationState | undefined;
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    act(() => {
      renderer = ReactTestRenderer.create(<HookProbe isMenuOpen={false} durationMs={200} onState={(s) => (state = s)} />);
    });

    act(() => {
      renderer.update(<HookProbe isMenuOpen durationMs={200} onState={(s) => (state = s)} />);
    });

    expect(state!.isMenuVisible).toBe(true);
  });

  it('isMenuOpen 変化時に Animated.timing が呼ばれる', () => {
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    act(() => {
      renderer = ReactTestRenderer.create(<HookProbe isMenuOpen={false} durationMs={300} onState={jest.fn()} />);
    });

    act(() => {
      renderer.update(<HookProbe isMenuOpen durationMs={300} onState={jest.fn()} />);
    });

    expect(Animated.timing).toHaveBeenCalledWith(expect.any(Animated.Value), expect.objectContaining({ toValue: 1, duration: 300 }));
  });

  it('resetMenuImmediately を呼ぶと isMenuVisible=false になる', () => {
    let state: MenuAnimationState | undefined;
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    act(() => {
      renderer = ReactTestRenderer.create(<HookProbe isMenuOpen durationMs={200} onState={(s) => (state = s)} />);
    });

    act(() => {
      state!.resetMenuImmediately();
    });

    // 再レンダー後の state を確認するため再度 update が必要
    act(() => {
      renderer.update(<HookProbe isMenuOpen durationMs={200} onState={(s) => (state = s)} />);
    });

    expect(state!.isMenuVisible).toBe(false);
  });

  it('menuProgress が Animated.Value のインスタンスである', () => {
    let state: MenuAnimationState | undefined;

    act(() => {
      ReactTestRenderer.create(<HookProbe isMenuOpen={false} durationMs={200} onState={(s) => (state = s)} />);
    });

    expect(state!.menuProgress).toBeInstanceOf(Animated.Value);
  });
});
