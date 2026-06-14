import type { ReactNode } from 'react';
import { Image, Text, View } from 'react-native';

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
  create: (element: ReactNode) => { root: any; update: (element: ReactNode) => void; unmount: () => void };
};

const styles = createStyles(lightTheme);

let renderer: { root: any; update: (element: ReactNode) => void; unmount: () => void } | null = null;

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
    expect(visibleTexts()).toContain('1 / 5');
    expect(visibleTexts()).toContain('Strolliaは、歩いた場所や移動した道のりを端末内に記録するGPSロガーです。');
    expect(visibleTexts()).toContain('記録したデータは、あなたの明示操作なしに外部へ送信しません。');
  });

  test('次へを押すと画面下の項目、実績、安全注意、権限案内の順に進む', () => {
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={jest.fn()} />);
    });

    press('次へ');
    expect(visibleTexts()).toContain('画面下の項目');
    expect(visibleTexts()).toContain('2 / 5');
    const instructionImage = renderer!.root.findByType(Image);
    expect(instructionImage.props.accessibilityLabel).toBe('マップ画面の要素説明');
    const instructionImageFrame = renderer!.root.findAllByType(View).find((node: any) => node.props.style === styles.firstLaunchTutorialInstructionImageFrame);
    expect(instructionImageFrame).toBeTruthy();
    act(() => {
      instructionImageFrame!.props.onLayout({ nativeEvent: { layout: { width: 300 } } });
    });
    const measuredInstructionImage = renderer!.root.findByType(Image);
    expect(measuredInstructionImage.props.style).toEqual([
      styles.firstLaunchTutorialInstructionImage,
      { width: 268, height: 268 / (453 / 279) },
    ]);
    expect(styles.firstLaunchTutorialInstructionImage).not.toEqual(expect.objectContaining({ width: '100%' }));
    expect(styles.firstLaunchTutorialInstructionImage).not.toEqual(expect.objectContaining({ alignSelf: 'stretch' }));

    press('次へ');
    expect(visibleTexts()).toContain('実績を集める');
    expect(visibleTexts()).toContain('3 / 5');

    press('次へ');
    expect(visibleTexts()).toContain('さいごに');
    expect(visibleTexts()).toContain('4 / 5');
    expect(visibleTexts()).toContain('安全に楽しくおさんぽするために、次のことを守りましょう。');
    expect(visibleTexts()).toContain('立入禁止の場所や私有地に入らない');
    expect(visibleTexts()).toContain('交通ルールを守り、まわりに注意する');
    expect(visibleTexts()).toContain('危険な場所には近づかない、入らない');
    expect(visibleTexts()).toContain('体調が悪くなったら無理に続けない');

    press('次へ');
    expect(visibleTexts()).toContain('位置情報を確認してはじめる');
    expect(visibleTexts()).toContain('5 / 5');
    expect(visibleTexts()).toContain('GPSログの記録には位置情報の常時許可が必要です。');
    expect(visibleTexts()).toContain('チュートリアルを閉じたあと、地図上に表示される位置情報の案内パネルから続けられます。');
  });

  test('最後のボタンで onComplete を呼ぶ', () => {
    const onComplete = jest.fn();
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={onComplete} />);
    });

    press('次へ');
    press('次へ');
    press('次へ');
    press('次へ');
    press('地図で確認する');

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('完了ボタンの文言を再表示用に変更できる', () => {
    const onComplete = jest.fn();
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible completionButtonLabel="閉じる" styles={styles} onComplete={onComplete} />);
    });

    press('次へ');
    press('次へ');
    press('次へ');
    press('次へ');
    expect(visibleTexts()).toContain('閉じる');
    press('チュートリアルを閉じる');

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('再表示したときは最初の説明から始まる', () => {
    const onComplete = jest.fn();
    act(() => {
      renderer = create(<FirstLaunchTutorialDialog visible styles={styles} onComplete={onComplete} />);
    });

    press('次へ');
    press('次へ');
    press('次へ');
    press('次へ');
    expect(visibleTexts()).toContain('5 / 5');

    act(() => {
      renderer!.update(<FirstLaunchTutorialDialog visible={false} styles={styles} onComplete={onComplete} />);
    });
    act(() => {
      renderer!.update(<FirstLaunchTutorialDialog visible styles={styles} onComplete={onComplete} />);
    });

    expect(visibleTexts()).toContain('1 / 5');
    expect(visibleTexts()).toContain('Strolliaへようこそ');
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
