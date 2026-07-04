import { Image, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { ShareButton } from '@/app/components/ShareButton';
import { reportStyles } from './reportStyles';

/** レポート各ページの共通枠。 */
export type ReportFrameProps = {
  /** ページタイトル。 */
  title: string;
  /** レポート年月ラベル。 */
  label: string;
  /** ページ数。 */
  pageCount: number;
  /** 現在ページ番号。 */
  pageIndex: number;
  /** ページ本体。 */
  children: ReactNode;
  /** 共有ボタン押下時の処理。 */
  onShare: () => void;
};

/** ストーリーレポートのヘッダー、進捗、共有ボタンをまとめる共通コンポーネント。 */
export function ReportFrame({ title, label, pageCount, pageIndex, children, onShare }: ReportFrameProps) {
  return (
    <View style={reportStyles.card}>
      <View style={reportStyles.progressRow}>
        {Array.from({ length: pageCount }).map((_, index) => (
          <View key={index} style={reportStyles.progressBar}>
            <View
              testID={`report-progress-fill-${index}`}
              style={[reportStyles.progressFill, { width: index <= pageIndex ? '100%' : '0%' }]}
            />
          </View>
        ))}
      </View>
      <View style={reportStyles.header}>
        <View style={reportStyles.headerIcon}>
          <Image source={require('../../../../assets/icon.png')} style={reportStyles.headerIconImage} resizeMode="contain" />
        </View>
        <View style={reportStyles.headerText}>
          <Text style={reportStyles.headerTitle}>{title}</Text>
          <Text style={reportStyles.headerSubtitle}>レポート {label}</Text>
        </View>
      </View>
      {children}
      <ShareButton
        accessibilityLabel="レポートを共有"
        iconColor="#777777"
        iconSize={28}
        style={reportStyles.shareButton}
        onPress={onShare}
      />
    </View>
  );
}
