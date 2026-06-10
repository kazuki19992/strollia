import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { AppStyles } from '../appStyles';
import { Dialog } from './Dialog';

/** 初回起動チュートリアルの1ステップ分の表示内容。 */
type TutorialStep = {
  /** 見出し。 */
  title: string;
  /** 本文。 */
  description: string;
};

/** 初回起動チュートリアルのprops。 */
export type FirstLaunchTutorialDialogProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** チュートリアル完了時に呼ぶ。 */
  onComplete: () => void;
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Strolliaへようこそ',
    description: 'Strolliaは、歩いた場所や移動した道のりを端末内に記録するGPSロガーです。記録したデータは、あなたの明示操作なしに外部へ送信しません。',
  },
  {
    title: '画面下の項目',
    description: '画面下から、日ごとの記録、実績、月ごとのレポート、設定を開けます。普段は地図を見ながら、必要なときに各項目を確認できます。',
  },
  {
    title: '実績を集める',
    description: '移動距離や訪問した地域、記録日数に応じて実績が解除されます。続けて使うほど、自分の移動の積み重ねが見えるようになります。',
  },
  {
    title: '権限を付与してはじめる',
    description: 'まずは位置情報の権限を付与してはじめましょう。チュートリアルを閉じたあと、地図上に表示される赤い権限付与パネルのボタンを押してください。',
  },
];

/** 初回起動時にアプリの使い始めを案内するダイアログ。 */
export function FirstLaunchTutorialDialog({ visible, styles, onComplete }: FirstLaunchTutorialDialogProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;
  const actionLabel = isLastStep ? '地図で確認する' : '次へ';

  /** 次の説明へ進み、最後の説明では完了する。 */
  function handlePrimaryAction(): void {
    if (isLastStep) {
      onComplete();
      return;
    }

    setStepIndex((index) => Math.min(index + 1, TUTORIAL_STEPS.length - 1));
  }

  return (
    <Dialog visible={visible} autoClose={false} swipeToClose={false} styles={styles} onClose={onComplete}>
      <Text style={styles.firstLaunchTutorialStepText}>{`${stepIndex + 1} / ${TUTORIAL_STEPS.length}`}</Text>
      <Text style={styles.firstLaunchTutorialTitle}>{currentStep.title}</Text>
      <Text style={styles.firstLaunchTutorialDescription}>{currentStep.description}</Text>
      <View style={styles.firstLaunchTutorialActions}>
        <Pressable accessibilityLabel={actionLabel} accessibilityRole="button" onPress={handlePrimaryAction} style={styles.firstLaunchTutorialButton}>
          <Text style={styles.firstLaunchTutorialButtonText}>{actionLabel}</Text>
        </Pressable>
      </View>
    </Dialog>
  );
}
