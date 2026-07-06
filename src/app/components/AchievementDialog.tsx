import { useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

import { AchievementListItem } from '@/features/achievements/achievementRepository';
import { shareViewAsPng } from '@/features/export/capturedViewShare';
import { AppTheme } from '@/theme/theme';
import { AppStyles } from '@/app/appStyles';
import { Dialog } from './Dialog';

/** 実績詳細ダイアログのprops。 */
export type AchievementDialogProps = {
  /** 表示する実績一覧アイテム。null で非表示。 */
  item: AchievementListItem | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 閉じる処理。 */
  onClose: () => void;
};

/** 解除済み実績をタップしたときに開く詳細ダイアログ。 */
export function AchievementDialog({ item, styles, theme, onClose }: AchievementDialogProps) {
  const captureViewRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  /**
   * 実績画像をシステム共有シートで共有する。
   *
   * `captureViewRef` が指すビューをPNGにキャプチャしてOSの共有シートを開く。
   * 共有不可な環境・キャプチャ/共有失敗時はアラートで通知し、Promiseは正常終了する。
   *
   * @returns 共有処理の完了を表す Promise。
   */
  async function shareAchievementImage(): Promise<void> {
    if (!captureViewRef.current || isSharing) {
      return;
    }

    setIsSharing(true);

    await shareViewAsPng(captureViewRef, {
      dialogTitle: 'すとろりあ 実績',
      errorFallbackMessage: '実績を共有できませんでした。',
      // キャプチャ前にレイアウトの反映を1フレーム待ち、描画が安定した状態で撮影する。
      onBeforeCapture: () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      onFinally: () => setIsSharing(false),
    });
  }

  return (
    <Dialog visible={item != null} styles={styles} onClose={onClose}>
      {item && (
        <>
          <View
            ref={captureViewRef}
            collapsable={false}
            style={[styles.achievementModalActions, { alignItems: 'center', backgroundColor: theme.colors.background }]}
          >
            <Image source={item.definition.trophyImage} style={styles.achievementModalImage} />
            <Text style={styles.achievementModalTitle}>{item.definition.title}</Text>
            {item.unlockedAt && (
              <Text style={styles.achievementDialogDate}>{`開放日: ${new Date(item.unlockedAt).toLocaleDateString()}`}</Text>
            )}
            <Text style={styles.achievementModalDescription}>{item.definition.description}</Text>
          </View>
          <View style={styles.achievementModalActions}>
            <Pressable
              accessibilityLabel="実績を共有する"
              accessibilityRole="button"
              onPress={shareAchievementImage}
              style={styles.achievementDialogShareButton}
            >
              <Feather name="share-2" size={18} color={styles.achievementDialogShareButtonText.color} />
              <Text style={styles.achievementDialogShareButtonText}>共有する</Text>
            </Pressable>
          </View>
        </>
      )}
    </Dialog>
  );
}
