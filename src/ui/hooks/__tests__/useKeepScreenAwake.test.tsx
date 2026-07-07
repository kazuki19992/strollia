import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useKeepScreenAwake } from '@/ui/hooks/useKeepScreenAwake';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: jest.fn().mockResolvedValue(undefined),
}));

type HookProbeProps = {
  enabled: boolean;
  appState: 'active' | 'background' | 'inactive' | 'unknown' | 'extension';
  tag: string;
};

/** hookを実行するための最小コンポーネント。 */
function HookProbe({ enabled, appState, tag }: HookProbeProps) {
  useKeepScreenAwake({ enabled, appState, tag });
  return null;
}

describe('画面ON維持 useKeepScreenAwake', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enabled=true かつ appState=active のとき activateKeepAwakeAsync を呼ぶ', () => {
    act(() => {
      ReactTestRenderer.create(<HookProbe enabled appState="active" tag="strollia" />);
    });

    expect(activateKeepAwakeAsync).toHaveBeenCalledWith('strollia');
    expect(deactivateKeepAwake).not.toHaveBeenCalled();
  });

  it('enabled=false のとき deactivateKeepAwake を呼ぶ', () => {
    act(() => {
      ReactTestRenderer.create(<HookProbe enabled={false} appState="active" tag="strollia" />);
    });

    expect(deactivateKeepAwake).toHaveBeenCalledWith('strollia');
    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
  });

  it('enabled=true でも appState=background のとき deactivateKeepAwake を呼ぶ', () => {
    act(() => {
      ReactTestRenderer.create(<HookProbe enabled appState="background" tag="strollia" />);
    });

    expect(deactivateKeepAwake).toHaveBeenCalledWith('strollia');
    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
  });

  it('アンマウント時に deactivateKeepAwake が呼ばれる', () => {
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    act(() => {
      renderer = ReactTestRenderer.create(<HookProbe enabled appState="active" tag="strollia" />);
    });

    jest.clearAllMocks();

    act(() => {
      renderer.unmount();
    });

    expect(deactivateKeepAwake).toHaveBeenCalledWith('strollia');
  });

  it('enabled=true → false に変化すると deactivateKeepAwake が呼ばれる', () => {
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    act(() => {
      renderer = ReactTestRenderer.create(<HookProbe enabled appState="active" tag="strollia" />);
    });

    jest.clearAllMocks();

    act(() => {
      renderer.update(<HookProbe enabled={false} appState="active" tag="strollia" />);
    });

    expect(deactivateKeepAwake).toHaveBeenCalledWith('strollia');
    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
  });
});
