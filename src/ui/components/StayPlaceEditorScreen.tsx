import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import type { LatLng, Region } from 'react-native-maps';

import { getStayPlaceEmoji, isStayPlaceEmojiHexcode, STAY_PLACE_EMOJIS } from '@/features/stayPlaces/stayPlaceEmojiCatalog';
import {
  isStayPlacePrivacyRadiusMeters,
  STAY_PLACE_PRIVACY_RADIUS_METERS,
  type SaveStayPlaceInput,
  type StayPlace,
} from '@/features/stayPlaces/stayPlaceTypes';
import { formatStayPlacePrivacyRadius } from '@/features/stayPlaces/stayPlacePrivacy';
import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';
import { ActionPill } from './ActionPill';
import { AppScreenHeader } from './AppScreenHeader';
import { DescriptionText } from './DescriptionText';
import { ScreenSection } from './ScreenSection';
import { SelectionDropdown } from './SelectionDropdown';

/** 滞在場所編集画面のprops。 */
export type StayPlaceEditorScreenProps = {
  /** 新規作成時の現在地。未取得なら東京駅付近は表示専用で、保存座標には使わない。 */
  initialCoordinate: LatLng | null;
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
/** 現在地未取得時に、地点を捏造せず地図を操作できるよう表示だけに使う中心。 */
const DEFAULT_EDITOR_VIEWPORT_COORDINATE = { latitude: 35.681236, longitude: 139.767125 };

/** 編集に使う地図regionを座標から作る。 */
function createEditorRegion(coordinate: LatLng): Region {
  return { ...coordinate, latitudeDelta: 0.005, longitudeDelta: 0.005 };
}

/** 滞在場所の新規作成・編集画面。 */
export function StayPlaceEditorScreen({ initialCoordinate, place, styles, theme, onBack, onDelete, onSave }: StayPlaceEditorScreenProps) {
  const [name, setName] = useState(place?.name ?? '');
  const [iconHexcode, setIconHexcode] = useState(place?.iconHexcode ?? DEFAULT_ICON_HEXCODE);
  const [coordinate, setCoordinate] = useState<LatLng | null>(
    place ? { latitude: place.latitude, longitude: place.longitude } : initialCoordinate,
  );
  const [privacyRadiusMeters, setPrivacyRadiusMeters] = useState<number | null>(place?.privacyRadiusMeters ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const selectedEmoji = getStayPlaceEmoji(iconHexcode);

  /** 入力を検証し、成功時だけProviderへ保存を委譲する。 */
  async function handleSave(): Promise<void> {
    if (isSavingRef.current) {
      return;
    }
    if (name.trim().length === 0) {
      setErrorMessage('滞在場所名を入力してください');
      return;
    }
    if (coordinate === null) {
      setErrorMessage('地図を動かして中心位置を選んでください');
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
      isSavingRef.current = true;
      setIsSaving(true);
      setErrorMessage(null);
      await onSave({ name: name.trim(), iconHexcode, latitude: coordinate.latitude, longitude: coordinate.longitude, privacyRadiusMeters });
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : '滞在場所を保存できませんでした');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
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
          <SelectionDropdown
            accessibilityLabel="アイコンを選択"
            getKey={(emoji) => emoji.hexcode}
            getLabel={(emoji) => emoji.label}
            options={STAY_PLACE_EMOJIS}
            selectedValue={selectedEmoji ?? STAY_PLACE_EMOJIS[0]}
            styles={styles}
            theme={theme}
            renderLeading={(emoji) => (
              <Image accessibilityLabel={`${emoji.label}のTwemojiアイコン`} source={emoji.asset} style={styles.stayPlaceEmojiPickerImage} />
            )}
            onSelect={(emoji) => setIconHexcode(emoji.hexcode)}
          />
        </ScreenSection>
        <ScreenSection styles={styles} title="中心位置">
          <DescriptionText styles={styles}>地図を動かして、中央のマーカーを場所の中心へ合わせてください。</DescriptionText>
          <View style={styles.stayPlaceEditorMapContainer}>
            <MapView
              accessibilityLabel="滞在場所の中心を選ぶ地図"
              initialRegion={createEditorRegion(coordinate ?? DEFAULT_EDITOR_VIEWPORT_COORDINATE)}
              style={styles.stayPlaceEditorMap}
              onRegionChangeComplete={(region) => setCoordinate({ latitude: region.latitude, longitude: region.longitude })}
            >
              {coordinate !== null && privacyRadiusMeters !== null ? (
                <Circle
                  center={coordinate}
                  fillColor={`${theme.colors.primary}24`}
                  radius={privacyRadiusMeters}
                  strokeColor={theme.colors.primary}
                  strokeWidth={1}
                  testID="stay-place-privacy-circle"
                />
              ) : null}
            </MapView>
            <View pointerEvents="none" style={styles.stayPlaceEditorMapCenterMarker} testID="stay-place-map-center-marker">
              <Feather name="map-pin" size={34} color={theme.colors.primary} />
            </View>
          </View>
        </ScreenSection>
        <ScreenSection styles={styles} title="共有時の非表示範囲">
          <DescriptionText styles={styles}>非表示範囲を設定すると、この場所の周辺を共有するルートから隠します。</DescriptionText>
          <SelectionDropdown
            accessibilityLabel="共有時の非表示範囲を選択"
            getKey={(radius) => String(radius ?? 'include')}
            getLabel={formatStayPlacePrivacyRadius}
            options={[null, ...STAY_PLACE_PRIVACY_RADIUS_METERS]}
            selectedValue={privacyRadiusMeters}
            styles={styles}
            theme={theme}
            onSelect={setPrivacyRadiusMeters}
          />
          <DescriptionText styles={styles}>
            この円内のルートは共有画像・GIF・月次レポートでは隠れます。通常の地図やGPXには影響しません。
          </DescriptionText>
        </ScreenSection>
        {errorMessage ? <Text style={styles.stayPlaceFormError}>{errorMessage}</Text> : null}
        <ActionPill
          alignLeft
          disabled={isSaving}
          icon={<Feather name="save" size={20} color={theme.colors.text} />}
          label={isSaving ? '滞在場所を保存中…' : '滞在場所を保存'}
          styles={styles}
          onPress={() => {
            handleSave().catch(() => undefined);
          }}
        />
        {place && onDelete ? <ActionPill alignLeft danger label="滞在場所を削除" styles={styles} onPress={handleDelete} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
