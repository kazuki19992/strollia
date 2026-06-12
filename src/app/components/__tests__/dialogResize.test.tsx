import { LayoutAnimation } from 'react-native';

import { animateDialogResize } from '../Dialog';
import { FirstLaunchTutorialDialog } from '../FirstLaunchTutorialDialog';

const ReactTestRenderer = require('react-test-renderer');

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
jest.mock('../ConfettiOverlay', () => ({ ConfettiOverlay: () => null }));

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

    let tree: any;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <FirstLaunchTutorialDialog visible styles={styles} onComplete={() => undefined} />,
      );
    });

    ReactTestRenderer.act(() => {
      tree.root.findByProps({ accessibilityLabel: '次へ' }).props.onPress();
    });

    expect(spy).toHaveBeenCalled();
  });
});
