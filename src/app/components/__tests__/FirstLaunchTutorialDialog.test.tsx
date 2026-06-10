import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { createStyles } from '../../appStyles';
import { lightTheme } from '../../../theme/theme';
import { FirstLaunchTutorialDialog } from '../FirstLaunchTutorialDialog';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text, MaterialCommunityIcons: Text };
});

jest.mock('../ConfettiOverlay', () => ({ ConfettiOverlay: () => null }));

const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void) => void;
  create: (element: ReactNode) => { root: any; unmount: () => void };
};

const styles = createStyles(lightTheme);

let renderer: { root: any; unmount: () => void } | null = null;

function visibleTexts(): unknown[] {
  return renderer!.root.findAllByType(Text).map((node: any) => node.props.children);
}

function press(label: string): void {
  const button = renderer!.root.findByProps({ accessibilityLabel: label });
  act(() => {
    button.props.onPress();
  });
}

describe('初回起動チュートリアル FirstLaunchTutorialDialog', () => {
  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
  });

  test('最初にアプリ説明を表示する', () => {
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={jest.fn()} />);
    });

    expect(visibleTexts()).toContain('Strolliaへようこそ');
    expect(visibleTexts()).toContain('1 / 4');
    expect(visibleTexts()).toContain('Strolliaは、歩いた場所や移動した道のりを端末内に記録するGPSロガーです。記録したデータは、あなたの明示操作なしに外部へ送信しません。');
  });

  test('次へを押すと画面下の項目、実績、権限案内の順に進む', () => {
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={jest.fn()} />);
    });

    press('次へ');
    expect(visibleTexts()).toContain('画面下の項目');
    expect(visibleTexts()).toContain('2 / 4');

    press('次へ');
    expect(visibleTexts()).toContain('実績を集める');
    expect(visibleTexts()).toContain('3 / 4');

    press('次へ');
    expect(visibleTexts()).toContain('権限を付与してはじめる');
    expect(visibleTexts()).toContain('4 / 4');
    expect(visibleTexts()).toContain('まずは位置情報の権限を付与してはじめましょう。チュートリアルを閉じたあと、地図上に表示される赤い権限付与パネルのボタンを押してください。');
  });

  test('最後のボタンで onComplete を呼ぶ', () => {
    const onComplete = jest.fn();
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={onComplete} />);
    });

    press('次へ');
    press('次へ');
    press('次へ');
    press('地図で確認する');

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('閉じるボタンで onComplete を呼ぶ', () => {
    const onComplete = jest.fn();
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={onComplete} />);
    });

    const closeButton = renderer!.root.findByProps({ accessibilityLabel: '閉じる' });
    act(() => {
      closeButton.props.onPress();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('スワイプヒントを表示しない', () => {
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={jest.fn()} />);
    });

    expect(visibleTexts()).not.toContain('スワイプで閉じる');
  });
});
