import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type { ReactNode } from 'react';

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
            <View style={[reportStyles.progressFill, { width: index <= pageIndex ? '100%' : '0%' }]} />
          </View>
        ))}
      </View>
      <View style={reportStyles.header}>
        <View style={reportStyles.headerIcon}>
          <Text style={reportStyles.headerIconText}>⌖</Text>
        </View>
        <View style={reportStyles.headerText}>
          <Text style={reportStyles.headerTitle}>{title}</Text>
          <Text style={reportStyles.headerSubtitle}>Report {label}</Text>
        </View>
      </View>
      {children}
      <Pressable accessibilityLabel="レポートを共有" accessibilityRole="button" onPress={onShare} style={reportStyles.shareButton}>
        <Feather name="share-2" size={28} color="#777777" />
      </Pressable>
    </View>
  );
}
