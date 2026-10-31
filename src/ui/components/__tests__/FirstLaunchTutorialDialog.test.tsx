import { Image } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';
import { FirstLaunchTutorialDialog } from '@/ui/components/FirstLaunchTutorialDialog';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text, MaterialCommunityIcons: Text };
});

jest.mock('@/ui/components/ConfettiOverlay', () => ({ ConfettiOverlay: () => null }));

const styles = createStyles(lightTheme);
const areaInstructionImage = require('../../../../assets/tutorial/area-instruction.png');

/** 指定ラベルのボタンを押す。 */
async function press(label: string): Promise<void> {
  await act(async () => {
    await fireEvent.press(screen.getByLabelText(label));
  });
}

describe('初回起動チュートリアル FirstLaunchTutorialDialog', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('最初にアプリ説明を表示する', async () => {
    await render(
      <FirstLaunchTutorialDialog
        visible
        styles={styles}
        onComplete={jest.fn()}
        crashReportingEnabled
        onUpdateCrashReportingEnabled={jest.fn()}
      />,
    );

    expect(screen.getByText('すとろりあへようこそ')).toBeTruthy();
    expect(screen.getByText('1 / 7')).toBeTruthy();
    expect(screen.getByText('すとろりあは、歩いた場所や移動した道のりを端末内に記録するGPSロガーです。')).toBeTruthy();
    expect(screen.getByText('記録したデータは、あなたの明示操作なしに外部へ送信しません。')).toBeTruthy();
  });

  test('次へを押すと画面下の項目、エリア、実績、安全注意、権限案内の順に進む', async () => {
    await render(
      <FirstLaunchTutorialDialog
        visible
        styles={styles}
        onComplete={jest.fn()}
        crashReportingEnabled
        onUpdateCrashReportingEnabled={jest.fn()}
      />,
    );

    await press('次へ');
    expect(screen.getByText('画面下の項目')).toBeTruthy();
    expect(screen.getByText('2 / 7')).toBeTruthy();
    // Image の accessibilityLabel で確認する
    const instructionImage = screen.getByLabelText('マップ画面の要素説明');
    expect(instructionImage.props.accessibilityLabel).toBe('マップ画面の要素説明');

    await press('次へ');
    expect(screen.getByText('エリアを広げよう')).toBeTruthy();
    expect(screen.getByText('3 / 7')).toBeTruthy();
    expect(screen.getByText('地図上で薄く色が塗られているマスを、すとろりあでは「エリア」と呼びます。')).toBeTruthy();
    expect(
      screen.getByText(
        '歩いた場所がエリアとして記録され、地図に少しずつ広がっていきます。いろいろな道を歩いて、自分だけの地図を育てていきましょう。',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('地図上のエリアの説明')).toBeTruthy();

    await press('次へ');
    expect(screen.getByText('実績を集める')).toBeTruthy();
    expect(screen.getByText('4 / 7')).toBeTruthy();

    await press('次へ');
    expect(screen.getByText('さいごに')).toBeTruthy();
    expect(screen.getByText('5 / 7')).toBeTruthy();
    expect(screen.getByText('安全に楽しくおさんぽするために、次のことを守りましょう。')).toBeTruthy();
    expect(screen.getByText('立入禁止の場所や私有地に入らない')).toBeTruthy();
    expect(screen.getByText('交通ルールを守り、まわりに注意する')).toBeTruthy();
    expect(screen.getByText('危険な場所には近づかない、入らない')).toBeTruthy();
    expect(screen.getByText('体調が悪くなったら無理に続けない')).toBeTruthy();

    await press('次へ');
    expect(screen.getByText('不具合レポートについて')).toBeTruthy();
    expect(screen.getByText('6 / 7')).toBeTruthy();

    await press('次へ');
    expect(screen.getByText('位置情報を確認してはじめる')).toBeTruthy();
    expect(screen.getByText('7 / 7')).toBeTruthy();
    expect(screen.getByText('GPSログの記録には位置情報の常時許可が必要です。')).toBeTruthy();
    expect(screen.getByText('チュートリアルを閉じたあと、地図上に表示される位置情報の案内パネルから続けられます。')).toBeTruthy();
  });

  test('補足画像ごとのアスペクト比を保って画像枠内に表示する', async () => {
    jest.spyOn(Image, 'resolveAssetSource').mockImplementation((source) => {
      if (source === areaInstructionImage) {
        return { width: 903, height: 540, scale: 1, uri: 'area-instruction.png' };
      }
      return { width: 453, height: 279, scale: 1, uri: 'home-screen-instruction.png' };
    });
    await render(
      <FirstLaunchTutorialDialog
        visible
        styles={styles}
        onComplete={jest.fn()}
        crashReportingEnabled
        onUpdateCrashReportingEnabled={jest.fn()}
      />,
    );

    await press('次へ');

    // instructionImageFrame の View を container からホスト View 要素として探す
    // onLayout を持つ特定スタイルの View を検索するため、型名と style で絞り込む
    const instructionImageFrame = screen.container
      .queryAll((node) => node.type === 'View')
      .find((node) => node.props.style === styles.firstLaunchTutorialInstructionImageFrame);
    expect(instructionImageFrame).toBeTruthy();
    await fireEvent(instructionImageFrame!, 'layout', { nativeEvent: { layout: { width: 300 } } });

    // Image の style を確認する
    const instructionImage = screen.getByLabelText('マップ画面の要素説明');
    expect(instructionImage.props.style).toEqual([styles.firstLaunchTutorialInstructionImage, { width: 268, height: 268 / (453 / 279) }]);

    await press('次へ');
    const areaImage = screen.getByLabelText('地図上のエリアの説明');
    expect(areaImage.props.style).toEqual([styles.firstLaunchTutorialInstructionImage, { width: 268, height: 268 / (903 / 540) }]);
    expect(styles.firstLaunchTutorialInstructionImage).not.toEqual(expect.objectContaining({ width: '100%' }));
    expect(styles.firstLaunchTutorialInstructionImage).not.toEqual(expect.objectContaining({ alignSelf: 'stretch' }));
  });

  test('補足画像の元サイズを取得できないときは既存画像比率へフォールバックする', async () => {
    jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({
      width: 0,
      height: 0,
      scale: 1,
      uri: 'invalid-instruction.png',
    });
    await render(
      <FirstLaunchTutorialDialog
        visible
        styles={styles}
        onComplete={jest.fn()}
        crashReportingEnabled
        onUpdateCrashReportingEnabled={jest.fn()}
      />,
    );

    await press('次へ');

    // instructionImageFrame の View を container からホスト View 要素として探す
    const instructionImageFrame = screen.container
      .queryAll((node) => node.type === 'View')
      .find((node) => node.props.style === styles.firstLaunchTutorialInstructionImageFrame);
    expect(instructionImageFrame).toBeTruthy();
    await fireEvent(instructionImageFrame!, 'layout', { nativeEvent: { layout: { width: 300 } } });

    const instructionImage = screen.getByLabelText('マップ画面の要素説明');
    expect(instructionImage.props.style).toEqual([styles.firstLaunchTutorialInstructionImage, { width: 268, height: 268 / (453 / 279) }]);
  });

  test('最後のボタンで onComplete を呼ぶ', async () => {
    const onComplete = jest.fn();
    await render(
      <FirstLaunchTutorialDialog
        visible
        styles={styles}
        onComplete={onComplete}
        crashReportingEnabled
        onUpdateCrashReportingEnabled={jest.fn()}
      />,
    );

    await press('次へ');
    await press('次へ');
    await press('次へ');
    await press('次へ');
    await press('次へ');
    await press('次へ');
    await press('地図で確認する');

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('完了ボタンの文言を再表示用に変更できる', async () => {
    const onComplete = jest.fn();
    await render(
      <FirstLaunchTutorialDialog
        visible
        completionButtonLabel="閉じる"
        styles={styles}
        onComplete={onComplete}
        crashReportingEnabled
        onUpdateCrashReportingEnabled={jest.fn()}
      />,
    );

    await press('次へ');
    await press('次へ');
    await press('次へ');
    await press('次へ');
    await press('次へ');
    await press('次へ');
    expect(screen.getByText('閉じる')).toBeTruthy();
    await press('チュートリアルを閉じる');

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('再表示したときは最初の説明から始まる', async () => {
    const onComplete = jest.fn();
    const { rerender } = await render(
      <FirstLaunchTutorialDialog
        visible
        styles={styles}
        onComplete={onComplete}
        crashReportingEnabled
        onUpdateCrashReportingEnabled={jest.fn()}
      />,
    );

    await press('次へ');
    await press('次へ');
    await press('次へ');
    await press('次へ');
    await press('次へ');
    await press('次へ');
    expect(screen.getByText('7 / 7')).toBeTruthy();

    await act(async () => {
      await rerender(
        <FirstLaunchTutorialDialog
          visible={false}
          styles={styles}
          onComplete={onComplete}
          crashReportingEnabled
          onUpdateCrashReportingEnabled={jest.fn()}
        />,
      );
    });
    await act(async () => {
      await rerender(
        <FirstLaunchTutorialDialog
          visible
          styles={styles}
          onComplete={onComplete}
          crashReportingEnabled
          onUpdateCrashReportingEnabled={jest.fn()}
        />,
      );
    });

    expect(screen.getByText('1 / 7')).toBeTruthy();
    expect(screen.getByText('すとろりあへようこそ')).toBeTruthy();
  });

  test('閉じるボタンで onComplete を呼ぶ', async () => {
    const onComplete = jest.fn();
    await render(
      <FirstLaunchTutorialDialog
        visible
        styles={styles}
        onComplete={onComplete}
        crashReportingEnabled
        onUpdateCrashReportingEnabled={jest.fn()}
      />,
    );

    await act(async () => {
      await fireEvent.press(screen.getByLabelText('閉じる'));
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('スワイプヒントを表示しない', async () => {
    await render(
      <FirstLaunchTutorialDialog
        visible
        styles={styles}
        onComplete={jest.fn()}
        crashReportingEnabled
        onUpdateCrashReportingEnabled={jest.fn()}
      />,
    );

    expect(screen.queryByText('スワイプで閉じる')).toBeNull();
  });

  test('不具合レポート告知ステップのスイッチを切り替えると更新処理を呼ぶ', async () => {
    const onUpdate = jest.fn();
    await render(
      <FirstLaunchTutorialDialog
        visible
        styles={styles}
        onComplete={jest.fn()}
        crashReportingEnabled
        onUpdateCrashReportingEnabled={onUpdate}
      />,
    );

    // 告知ステップ(不具合レポートについて)まで「次へ」で進む
    // タイトルが表示されるまで進める
    for (let i = 0; i < 10; i += 1) {
      if (screen.queryByText('不具合レポートについて')) {
        break;
      }
      await press('次へ');
    }

    expect(screen.getByText('不具合レポートについて')).toBeTruthy();

    await act(async () => {
      await fireEvent(screen.getByLabelText('不具合レポートを送る'), 'valueChange', false);
    });

    expect(onUpdate).toHaveBeenCalledWith(false);
  });
});
