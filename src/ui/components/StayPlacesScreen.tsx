import { Feather } from '@expo/vector-icons';
import { Image, SafeAreaView, ScrollView, Text } from 'react-native';

import { getStayPlaceEmoji } from '@/features/stayPlaces/stayPlaceEmojiCatalog';
import { formatStayPlacePrivacyRadius } from '@/features/stayPlaces/stayPlacePrivacy';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';
import { ActionPill } from './ActionPill';
import { AppListItem } from './AppListItem';
import { AppScreenHeader } from './AppScreenHeader';
import { DescriptionText } from './DescriptionText';
import { ScreenSection } from './ScreenSection';

/** 滞在場所一覧画面のprops。 */
export type StayPlacesScreenProps = {
  /** Plusが有効か。 */
  isPlusActive: boolean;
  /** 作成順に並んだ登録済み場所。 */
  stayPlaces: StayPlace[];
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 設定へ戻る。 */
  onBackToSettings: () => void;
  /** 指定場所の編集を開く。 */
  onOpenEditor: (id: number) => void;
  /** 新規作成を開く。 */
  onOpenNew: () => void;
  /** 既存のPlus購入導線を開く。 */
  onOpenPremiumPaywall: () => void;
};

/**
 * Formats a stay place's privacy radius for display.
 *
 * @param privacyRadiusMeters - The privacy radius in meters, or `null` to include the place when sharing.
 * @returns A user-facing description of the sharing privacy setting.
 */
function formatPrivacyRadius(privacyRadiusMeters: number | null): string {
  if (privacyRadiusMeters === null) {
    return '共有時もこの場所を含める';
  }

  return `共有時は中心から${formatStayPlacePrivacyRadius(privacyRadiusMeters)}以内を隠す`;
}

/**
 * Determines the status label for a stay place based on its position and Plus membership.
 *
 * @param index - The stay place's zero-based position in creation order
 * @returns `現在有効` if Plus is active or the place is first, `Plusで有効` otherwise
 */
function getStayPlaceStatusLabel(index: number, isPlusActive: boolean): string {
  return isPlusActive || index === 0 ? '現在有効' : 'Plusで有効';
}

/**
 * Displays registered stay places in creation order and provides actions to edit or add them.
 *
 * @param isPlusActive - Whether the user has an active Plus subscription
 * @param stayPlaces - Registered stay places to display
 * @param onBackToSettings - Opens the settings screen
 * @param onOpenEditor - Opens the editor for a stay place
 * @param onOpenNew - Opens the new stay place flow
 * @param onOpenPremiumPaywall - Opens the Plus subscription paywall
 */
export function StayPlacesScreen({
  isPlusActive,
  stayPlaces,
  styles,
  theme,
  onBackToSettings,
  onOpenEditor,
  onOpenNew,
  onOpenPremiumPaywall,
}: StayPlacesScreenProps) {
  const hasFreeCreationLimit = !isPlusActive && stayPlaces.length >= 1;

  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="設定" styles={styles} theme={theme} title="滞在場所" onBack={onBackToSettings} />
      <ScrollView contentContainerStyle={styles.screenList}>
        <ScreenSection styles={styles} title="登録した場所">
          <DescriptionText styles={styles}>
            {isPlusActive ? '登録したすべての場所を使用します。' : '最初に登録した場所を使用します。'}
          </DescriptionText>
          {stayPlaces.length === 0 ? <Text style={styles.emptyText}>滞在場所はまだ登録されていません。</Text> : null}
          {stayPlaces.map((place, index) => {
            const emoji = getStayPlaceEmoji(place.iconHexcode);
            return (
              <AppListItem
                key={place.id}
                accessibilityLabel={`${place.name}を編集`}
                detail={formatPrivacyRadius(place.privacyRadiusMeters)}
                leading={emoji ? <Image source={emoji.asset} style={styles.stayPlaceEmojiImage} /> : undefined}
                subtitle={getStayPlaceStatusLabel(index, isPlusActive)}
                styles={styles}
                theme={theme}
                title={place.name}
                onPress={() => onOpenEditor(place.id)}
              />
            );
          })}
        </ScreenSection>
        <ActionPill
          alignLeft
          icon={<Feather name="plus" size={20} color={theme.colors.text} />}
          label="滞在場所を追加"
          styles={styles}
          onPress={hasFreeCreationLimit ? onOpenPremiumPaywall : onOpenNew}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
