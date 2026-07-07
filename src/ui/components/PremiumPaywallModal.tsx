import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Linking, Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/config/legalLinks';
import type { PremiumOfferingSummary } from '@/features/premium/revenueCatAccess';
import { SUBSCRIPTION_DISCLOSURE_TEXT } from '@/features/premium/subscriptionDisclosure';
import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';
import { ActionPill } from './ActionPill';
import { DescriptionText } from './DescriptionText';
import { InfoBlock } from './InfoBlock';
import { PlusAdImage } from './PlusAdImage';

export type PremiumPaywallModalProps = {
  /** モーダルの表示状態。 */
  visible: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** RevenueCat Offering概要。 */
  premiumOfferingSummary: PremiumOfferingSummary | null;
  /** 商品情報読み込み中か。 */
  isLoadingPremiumOffering: boolean;
  /** サブスク購入処理中か。 */
  isPurchasingPremiumPackage: boolean;
  /** 購入復元処理中か。 */
  isRestoringPremiumPurchases: boolean;
  /** 閉じる処理。 */
  onClose: () => void;
  /** 月払い購入処理。 */
  onPurchaseMonthlyPremiumPackage: () => void;
  /** 年払い購入処理。 */
  onPurchaseYearlyPremiumPackage: () => void;
  /** 購入復元処理。 */
  onRestorePremiumPurchases: () => void;
};

/** Strollia Plus への加入を促す全画面モーダル。 */
export function PremiumPaywallModal({
  visible,
  styles,
  theme,
  premiumOfferingSummary,
  isLoadingPremiumOffering,
  isPurchasingPremiumPackage,
  isRestoringPremiumPurchases,
  onClose,
  onPurchaseMonthlyPremiumPackage,
  onPurchaseYearlyPremiumPackage,
  onRestorePremiumPurchases,
}: PremiumPaywallModalProps) {
  /** フォールバック価格は本番の定価と一致しており、Offering 未取得時に表示される暫定値。 */

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.appScreen}>
        <View style={styles.appHeader}>
          <Pressable accessibilityLabel="ペイウォールを閉じる" accessibilityRole="button" onPress={onClose}>
            <Feather name="x" size={24} color={theme.colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.screenList}>
          <InfoBlock
            description="月額300円の有料サービスです。年払いにすると1か月分オトクです!"
            styles={styles}
            title="Strollia Plus(有料サブスクリプション)のごあんない"
          />
          <PlusAdImage accessibilityLabel="Strollia Plusの機能比較広告" width="100%" />
          <DescriptionText styles={styles}>いつでも解約できます。</DescriptionText>
          <ActionPill
            alignLeft
            backgroundColor={theme.colors.plusCtaBackground}
            borderColor={theme.colors.primary}
            disabled={isPurchasingPremiumPackage}
            icon={<MaterialCommunityIcons name="currency-usd" size={21} color={theme.colors.primary} />}
            label={isPurchasingPremiumPackage ? '購入処理中...' : '月額300円ではじめる！'}
            styles={styles}
            textColor={theme.colors.primary}
            onPress={onPurchaseMonthlyPremiumPackage}
          />
          <ActionPill
            alignLeft
            backgroundColor={theme.colors.plusCtaBackground}
            borderColor={theme.colors.primary}
            disabled={isPurchasingPremiumPackage}
            icon={<MaterialCommunityIcons name="currency-usd" size={21} color={theme.colors.primary} />}
            label={isPurchasingPremiumPackage ? '購入処理中...' : '年額3300円ではじめる！'}
            styles={styles}
            textColor={theme.colors.primary}
            onPress={onPurchaseYearlyPremiumPackage}
          />
          <ActionPill
            alignLeft
            disabled={isRestoringPremiumPurchases}
            icon={<MaterialCommunityIcons name="restore" size={24} color={theme.colors.text} />}
            label={isRestoringPremiumPurchases ? '復元中...' : 'Strollia Plusの購入を復元する'}
            styles={styles}
            onPress={onRestorePremiumPurchases}
          />
          {isLoadingPremiumOffering && <DescriptionText styles={styles}>商品情報を確認しています...</DescriptionText>}
          <View style={styles.paywallLegal}>
            <DescriptionText styles={styles}>{SUBSCRIPTION_DISCLOSURE_TEXT}</DescriptionText>
            <View style={styles.paywallLegalLinks}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="利用規約を開く"
                onPress={() => {
                  Linking.openURL(TERMS_OF_SERVICE_URL).catch(() => undefined);
                }}
              >
                <Text style={styles.paywallLegalLink}>利用規約</Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="プライバシーポリシーを開く"
                onPress={() => {
                  Linking.openURL(PRIVACY_POLICY_URL).catch(() => undefined);
                }}
              >
                <Text style={styles.paywallLegalLink}>プライバシーポリシー</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
