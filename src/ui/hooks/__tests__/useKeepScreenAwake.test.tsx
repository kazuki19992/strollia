import { act, renderHook } from '@testing-library/react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useKeepScreenAwake } from '@/ui/hooks/useKeepScreenAwake';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: jest.fn().mockResolvedValue(undefined),
}));

type HookProps = {
  enabled: boolean;
  appState: 'active' | 'background' | 'inactive' | 'unknown' | 'extension';
  tag: string;
};

describe('画面ON維持 useKeepScreenAwake', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enabled=true かつ appState=active のとき activateKeepAwakeAsync を呼ぶ', () => {
    renderHook(() => useKeepScreenAwake({ enabled: true, appState: 'active', tag: 'strollia' }));

    expect(activateKeepAwakeAsync).toHaveBeenCalledWith('strollia');
    expect(deactivateKeepAwake).not.toHaveBeenCalled();
  });

  it('enabled=false のとき deactivateKeepAwake を呼ぶ', () => {
    renderHook(() => useKeepScreenAwake({ enabled: false, appState: 'active', tag: 'strollia' }));

    expect(deactivateKeepAwake).toHaveBeenCalledWith('strollia');
    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
  });

  it('enabled=true でも appState=background のとき deactivateKeepAwake を呼ぶ', () => {
    renderHook(() => useKeepScreenAwake({ enabled: true, appState: 'background', tag: 'strollia' }));

    expect(deactivateKeepAwake).toHaveBeenCalledWith('strollia');
    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
  });

  it('アンマウント時に deactivateKeepAwake が呼ばれる', () => {
    const { unmount } = renderHook(() => useKeepScreenAwake({ enabled: true, appState: 'active', tag: 'strollia' }));

    jest.clearAllMocks();

    act(() => {
      unmount();
    });

    expect(deactivateKeepAwake).toHaveBeenCalledWith('strollia');
  });

  it('enabled=true → false に変化すると deactivateKeepAwake が呼ばれる', () => {
    const { rerender } = renderHook(({ enabled, appState, tag }: HookProps) => useKeepScreenAwake({ enabled, appState, tag }), {
      initialProps: { enabled: true, appState: 'active' as const, tag: 'strollia' },
    });

    jest.clearAllMocks();

    rerender({ enabled: false, appState: 'active', tag: 'strollia' });

    expect(deactivateKeepAwake).toHaveBeenCalledWith('strollia');
    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
  });
});
