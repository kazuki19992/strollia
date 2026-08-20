import { fireEvent, render, screen } from '@testing-library/react-native';
import { Image, StyleSheet } from 'react-native';

import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { StayPlaceMapMarker } from '@/ui/components/StayPlaceMapMarker';

jest.mock('react-native-maps', () => {
  const { Pressable } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports

  return {
    Marker: ({ accessibilityLabel, children, onPress }: { accessibilityLabel: string; children: React.ReactNode; onPress: () => void }) => (
      <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress}>
        {children}
      </Pressable>
    ),
  };
});

const place: StayPlace = {
  id: 1,
  name: '自宅',
  iconHexcode: '1F3E0',
  latitude: 35,
  longitude: 139,
  privacyRadiusMeters: 1000,
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
};

describe('滞在場所地図マーカー StayPlaceMapMarker', () => {
  test('Twemojiを四角い吹き出しに表示し、タップ時に場所を通知する', () => {
    const onPress = jest.fn();
    render(<StayPlaceMapMarker place={place} styles={createStyles(lightTheme)} onPress={onPress} />);

    // Imageのsourceは利用者に見えない実装詳細のため、ここだけ型検索でTwemojiアセットを確認する。
    expect(screen.UNSAFE_getByType(Image).props.source).toBeDefined();
    expect(StyleSheet.flatten(screen.getByTestId('stay-place-map-marker-bubble').props.style)).toMatchObject({ borderRadius: 10 });

    fireEvent.press(screen.getByLabelText('自宅を開く'));

    expect(onPress).toHaveBeenCalledWith(place);
  });
});
