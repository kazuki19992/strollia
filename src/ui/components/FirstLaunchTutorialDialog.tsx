import { useEffect, useState } from 'react';
import { Image, Pressable, Switch, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';
import {
  CRASH_REPORTING_TOGGLE_LABEL,
  CRASH_REPORTING_TUTORIAL_PARAGRAPHS,
  CRASH_REPORTING_TUTORIAL_TITLE,
} from '@/ui/appText';
import { animateDialogResize, Dialog } from './Dialog';

const FALLBACK_INSTRUCTION_IMAGE_ASPECT_RATIO = 453 / 279;
const INSTRUCTION_IMAGE_HORIZONTAL_PADDING = 16;

/** 補足画像の元サイズから、安全に表示用アスペクト比を解決する。 */
function resolveInstructionImageAspectRatio(source?: ImageSourcePropType): number {
  if (!source) {
    return FALLBACK_INSTRUCTION_IMAGE_ASPECT_RATIO;
  }

  const asset = Image.resolveAssetSource(source);
  if (!asset || asset.width <= 0 || asset.height <= 0) {
    return FALLBACK_INSTRUCTION_IMAGE_ASPECT_RATIO;
  }

  return asset.width / asset.height;
}

/** 初回起動チュートリアルの1ステップ分の表示内容。 */
type TutorialStep = {
  /** 見出し。 */
  title: string;
  /** 本文の段落。 */
  paragraphs: string[];
  /** タイトル下に表示する補足画像。 */
  instructionImage?: ImageSourcePropType;
  /** 補足画像のアクセシビリティラベル。 */
  instructionImageAccessibilityLabel?: string;
  /** 本文の下に表示する箇条書き。 */
  bulletItems?: string[];
  /** このステップで不具合レポートトグルを表示するか。 */
  showCrashReportingToggle?: boolean;
};

/** 初回起動チュートリアルのprops。 */
export type FirstLaunchTutorialDialogProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 最終ステップの完了ボタン文言。 */
  completionButtonLabel?: string;
  /** チュートリアル完了時に呼ぶ。 */
  onComplete: () => void;
  /** 不具合レポートを送信するか。 */
  crashReportingEnabled: boolean;
  /** 不具合レポート送信設定の更新処理。 */
  onUpdateCrashReportingEnabled: (enabled: boolean) => void;
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'すとろりあへようこそ',
    paragraphs: [
      'すとろりあは、歩いた場所や移動した道のりを端末内に記録するGPSロガーです。',
      '記録したデータは、あなたの明示操作なしに外部へ送信しません。',
    ],
  },
  {
    title: '画面下の項目',
    instructionImage: require('../../../assets/tutorial/home-screen-instruction.png'),
    instructionImageAccessibilityLabel: 'マップ画面の要素説明',
    paragraphs: [
      '画面下から、日ごとの記録、実績、月ごとのレポート、設定を開けます。',
      '普段は地図を見ながら、必要なときに各項目を確認できます。',
    ],
  },
  {
    title: 'エリアを広げよう',
    instructionImage: require('../../../assets/tutorial/area-instruction.png'),
    instructionImageAccessibilityLabel: '地図上のエリアの説明',
    paragraphs: [
      '地図上で薄く色が塗られているマスを、すとろりあでは「エリア」と呼びます。',
      '歩いた場所がエリアとして記録され、地図に少しずつ広がっていきます。いろいろな道を歩いて、自分だけの地図を育てていきましょう。',
    ],
  },
  {
    title: '実績を集める',
    paragraphs: [
      '移動距離や訪問した地域、記録日数に応じて実績が解除されます。',
      '続けて使うほど、自分の移動の積み重ねが見えるようになります。',
    ],
  },
  {
    title: 'さいごに',
    paragraphs: ['安全に楽しくおさんぽするために、次のことを守りましょう。'],
    bulletItems: [
      '立入禁止の場所や私有地に入らない',
      '交通ルールを守り、まわりに注意する',
      '危険な場所には近づかない、入らない',
      '体調が悪くなったら無理に続けない',
    ],
  },
  {
    title: CRASH_REPORTING_TUTORIAL_TITLE,
    paragraphs: CRASH_REPORTING_TUTORIAL_PARAGRAPHS,
    showCrashReportingToggle: true,
  },
  {
    title: '位置情報を確認してはじめる',
    paragraphs: [
      'GPSログの記録には位置情報の常時許可が必要です。',
      'チュートリアルを閉じたあと、地図上に表示される位置情報の案内パネルから続けられます。',
    ],
  },
];

/** 初回起動時にアプリの使い始めを案内するダイアログ。 */
export function FirstLaunchTutorialDialog({
  visible,
  styles,
  completionButtonLabel = '地図で確認する',
  onComplete,
  crashReportingEnabled,
  onUpdateCrashReportingEnabled,
}: FirstLaunchTutorialDialogProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [instructionImageFrameWidth, setInstructionImageFrameWidth] = useState(0);
  const currentStep = TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;
  const actionLabel = isLastStep ? completionButtonLabel : '次へ';
  const actionAccessibilityLabel = isLastStep && actionLabel === '閉じる' ? 'チュートリアルを閉じる' : actionLabel;
  const instructionImageAspectRatio = resolveInstructionImageAspectRatio(currentStep.instructionImage);
  const instructionImageWidth = Math.max(0, instructionImageFrameWidth - INSTRUCTION_IMAGE_HORIZONTAL_PADDING * 2);
  const instructionImageSize = {
    width: instructionImageWidth,
    height: instructionImageWidth / instructionImageAspectRatio,
  };

  useEffect(() => {
    if (visible) {
      setStepIndex(0);
    }
  }, [visible]);

  /** 次の説明へ進み、最後の説明では完了する。 */
  function handlePrimaryAction(): void {
    if (isLastStep) {
      onComplete();
      return;
    }

    // ステップが変わると説明文の量で高さが変わるので、滑らかにリサイズさせる。
    animateDialogResize();
    setStepIndex((index) => Math.min(index + 1, TUTORIAL_STEPS.length - 1));
  }

  return (
    <Dialog visible={visible} autoClose={false} swipeToClose={false} styles={styles} onClose={onComplete}>
      <Text style={styles.firstLaunchTutorialStepText}>{`${stepIndex + 1} / ${TUTORIAL_STEPS.length}`}</Text>
      <Text style={styles.firstLaunchTutorialTitle}>{currentStep.title}</Text>
      {currentStep.instructionImage && (
        <View
          style={styles.firstLaunchTutorialInstructionImageFrame}
          onLayout={(event) => setInstructionImageFrameWidth(event.nativeEvent.layout.width)}
        >
          <Image
            accessibilityLabel={currentStep.instructionImageAccessibilityLabel}
            resizeMode="contain"
            source={currentStep.instructionImage}
            style={[styles.firstLaunchTutorialInstructionImage, instructionImageSize]}
          />
        </View>
      )}
      <View style={styles.firstLaunchTutorialDescriptionGroup}>
        {currentStep.paragraphs.map((paragraph) => (
          <Text key={paragraph} style={styles.firstLaunchTutorialDescription}>
            {paragraph}
          </Text>
        ))}
      </View>
      {currentStep.showCrashReportingToggle && (
        <View style={styles.settingsInlineRow}>
          <Text style={styles.formItemTitle}>{CRASH_REPORTING_TOGGLE_LABEL}</Text>
          <Switch
            accessibilityLabel={CRASH_REPORTING_TOGGLE_LABEL}
            accessibilityRole="switch"
            value={crashReportingEnabled}
            onValueChange={onUpdateCrashReportingEnabled}
          />
        </View>
      )}
      {currentStep.bulletItems && (
        <View style={styles.firstLaunchTutorialBulletList}>
          {currentStep.bulletItems.map((item) => (
            <View key={item} style={styles.firstLaunchTutorialBulletRow}>
              <Text style={styles.firstLaunchTutorialBulletMark}>•</Text>
              <Text style={styles.firstLaunchTutorialBulletText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.firstLaunchTutorialActions}>
        <Pressable
          accessibilityLabel={actionAccessibilityLabel}
          accessibilityRole="button"
          onPress={handlePrimaryAction}
          style={styles.firstLaunchTutorialButton}
        >
          <Text style={styles.firstLaunchTutorialButtonText}>{actionLabel}</Text>
        </Pressable>
      </View>
    </Dialog>
  );
}
