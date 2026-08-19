import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import MapView from 'react-native-maps';
import type { LatLng, Region } from 'react-native-maps';

import { getStayPlaceEmoji, isStayPlaceEmojiHexcode } from '@/features/stayPlaces/stayPlaceEmojiCatalog';
import {
  isStayPlacePrivacyRadiusMeters,
  STAY_PLACE_PRIVACY_RADIUS_METERS,
  type SaveStayPlaceInput,
  type StayPlace,
} from '@/features/stayPlaces/stayPlaceTypes';
import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';
import { ActionPill } from './ActionPill';
import { AppScreenHeader } from './AppScreenHeader';
import { DescriptionText } from './DescriptionText';
import { ScreenSection } from './ScreenSection';
import { StayPlaceIconPicker } from './StayPlaceIconPicker';

/** 滞在場所編集画面のprops。 */
export type StayPlaceEditorScreenProps = {
  /** 新規作成時に使う地図中心。 */
  initialCoordinate: LatLng;
  /** 編集対象。新規作成時はnull。 */
  place: StayPlace | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 前画面へ戻る。 */
  onBack: () => void;
  /** 既存場所を削除する。新規作成画面では渡さない。 */
  onDelete?: () => Promise<void>;
  /** 入力を保存する。 */
  onSave: (input: SaveStayPlaceInput) => Promise<void>;
};

const DEFAULT_ICON_HEXCODE = '1F3E0';

/** 編集に使う地図regionを座標から作る。 */
function createEditorRegion(coordinate: LatLng): Region {
  return { ...coordinate, latitudeDelta: 0.005, longitudeDelta: 0.005 };
}

/** 半径を選択UI向けに表示する。 */
function formatPrivacyRadius(privacyRadiusMeters: number | null): string {
  if (privacyRadiusMeters === null) {
    return '含める';
  }

  return privacyRadiusMeters >= 1000 ? `${privacyRadiusMeters / 1000}km` : `${privacyRadiusMeters}m`;
}

/** 滞在場所の新規作成・編集画面。 */
export function StayPlaceEditorScreen({ initialCoordinate, place, styles, theme, onBack, onDelete, onSave }: StayPlaceEditorScreenProps) {
  const [name, setName] = useState(place?.name ?? '');
  const [iconHexcode, setIconHexcode] = useState(place?.iconHexcode ?? DEFAULT_ICON_HEXCODE);
  const [coordinate, setCoordinate] = useState<LatLng>(
    place ? { latitude: place.latitude, longitude: place.longitude } : initialCoordinate,
  );
  const [privacyRadiusMeters, setPrivacyRadiusMeters] = useState<number | null>(place?.privacyRadiusMeters ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIconPickerVisible, setIsIconPickerVisible] = useState(false);
  const selectedEmoji = getStayPlaceEmoji(iconHexcode);

  /** 入力を検証し、成功時だけProviderへ保存を委譲する。 */
  async function handleSave(): Promise<void> {
    if (name.trim().length === 0) {
      setErrorMessage('滞在場所名を入力してください');
      return;
    }
    if (
      !isStayPlaceEmojiHexcode(iconHexcode) ||
      !Number.isFinite(coordinate.latitude) ||
      !Number.isFinite(coordinate.longitude) ||
      !isStayPlacePrivacyRadiusMeters(privacyRadiusMeters)
    ) {
      setErrorMessage('入力内容を確認してください');
      return;
    }

    try {
      setErrorMessage(null);
      await onSave({ name: name.trim(), iconHexcode, latitude: coordinate.latitude, longitude: coordinate.longitude, privacyRadiusMeters });
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : '滞在場所を保存できませんでした');
    }
  }

  /** 確認後にProviderの削除操作を呼ぶ。 */
  function handleDelete(): void {
    if (!onDelete) {
      return;
    }

    Alert.alert('滞在場所を削除', 'この場所を削除します。保存済みの記録は変わりません。', [
      { style: 'cancel', text: 'キャンセル' },
      {
        style: 'destructive',
        text: '削除',
        onPress: () => {
          onDelete().catch((error: unknown) => {
            setErrorMessage(error instanceof Error ? error.message : '滞在場所を削除できませんでした');
          });
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader
        backLabel="滞在場所"
        styles={styles}
        theme={theme}
        title={place ? '滞在場所を編集' : '滞在場所を追加'}
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.screenList}>
        <ScreenSection styles={styles} title="名前">
          <TextInput
            accessibilityLabel="滞在場所名"
            maxLength={40}
            placeholder="例: 自宅"
            placeholderTextColor={theme.colors.mutedText}
            style={styles.stayPlaceEditorInput}
            value={name}
            onChangeText={setName}
          />
        </ScreenSection>
        <ScreenSection styles={styles} title="アイコン">
          <Pressable
            accessibilityLabel="アイコンを選択"
            accessibilityRole="button"
            style={styles.stayPlaceEmojiPickerButton}
            onPress={() => setIsIconPickerVisible(true)}
          >
            {selectedEmoji ? (
              <Text style={styles.formItemTitle}>{selectedEmoji.unicode}</Text>
            ) : (
              <Text style={styles.formItemTitle}>選択</Text>
            )}
          </Pressable>
        </ScreenSection>
        <ScreenSection styles={styles} title="中心位置">
          <DescriptionText styles={styles}>地図を動かして、中央のマーカーを場所の中心へ合わせてください。</DescriptionText>
          <View style={styles.stayPlaceEditorMapContainer}>
            <MapView
              accessibilityLabel="滞在場所の中心を選ぶ地図"
              initialRegion={createEditorRegion(coordinate)}
              style={styles.stayPlaceEditorMap}
              onRegionChangeComplete={(region) => setCoordinate({ latitude: region.latitude, longitude: region.longitude })}
            />
            <View pointerEvents="none" style={styles.stayPlaceEditorMapCenterMarker} testID="stay-place-map-center-marker">
              <Feather name="map-pin" size={34} color={theme.colors.primary} />
            </View>
          </View>
        </ScreenSection>
        <ScreenSection styles={styles} title="共有時の非表示範囲">
          <DescriptionText styles={styles}>この場所の周辺を共有するルートから隠します。</DescriptionText>
          <View style={styles.stayPlaceEmojiPickerGrid}>
            {[null, ...STAY_PLACE_PRIVACY_RADIUS_METERS].map((radius) => {
              const selected = privacyRadiusMeters === radius;
              return (
                <Pressable
                  key={radius ?? 'include'}
                  accessibilityLabel={`非表示範囲: ${formatPrivacyRadius(radius)}`}
                  accessibilityRole="button"
                  style={[styles.stayPlaceEmojiPickerButton, selected && styles.stayPlaceEmojiPickerButtonSelected]}
                  onPress={() => setPrivacyRadiusMeters(radius)}
                >
                  <Text style={styles.formItemTitle}>{formatPrivacyRadius(radius)}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScreenSection>
        {errorMessage ? <Text style={styles.stayPlaceFormError}>{errorMessage}</Text> : null}
        <ActionPill
          alignLeft
          icon={<Feather name="save" size={20} color={theme.colors.text} />}
          label="滞在場所を保存"
          styles={styles}
          onPress={() => {
            handleSave().catch(() => undefined);
          }}
        />
        {place && onDelete ? <ActionPill alignLeft danger label="滞在場所を削除" styles={styles} onPress={handleDelete} /> : null}
      </ScrollView>
      <StayPlaceIconPicker
        selectedHexcode={iconHexcode}
        styles={styles}
        theme={theme}
        visible={isIconPickerVisible}
        onClose={() => setIsIconPickerVisible(false)}
        onSelect={setIconHexcode}
      />
    </SafeAreaView>
  );
}
