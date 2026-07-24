import { LayoutAnimation } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { animateDialogResize } from '@/ui/components/Dialog';
import { FirstLaunchTutorialDialog } from '@/ui/components/FirstLaunchTutorialDialog';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
jest.mock('@/ui/components/ConfettiOverlay', () => ({ ConfettiOverlay: () => null }));

const styles = new Proxy({}, { get: () => ({}) }) as never;

describe('animateDialogResize', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('次のレイアウト変化を ease-in-out のトランジションで補間するよう設定する', () => {
    const spy = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => undefined);

    animateDialogResize();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 300,
        update: expect.objectContaining({ type: LayoutAnimation.Types.easeInEaseOut }),
      }),
    );
  });
});

describe('FirstLaunchTutorialDialog のサイズ変化アニメーション', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('「次へ」でステップを変える直前にリサイズアニメーションを設定する', () => {
    const spy = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => undefined);

    render(
      <FirstLaunchTutorialDialog
        visible
        styles={styles}
        onComplete={() => undefined}
        crashReportingEnabled
        onUpdateCrashReportingEnabled={() => undefined}
      />,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('次へ'));
    });

    expect(spy).toHaveBeenCalled();
  });
});
