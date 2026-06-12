import { useState } from 'react';
import { Image, View } from 'react-native';
import type { DimensionValue } from 'react-native';

const PLUS_AD_IMAGE_SOURCE = require('../../../assets/ad/plus-ad.png');
const plusAdImageAsset = Image.resolveAssetSource(PLUS_AD_IMAGE_SOURCE);
const PLUS_AD_IMAGE_DEFAULT_ASPECT_RATIO = 1044 / 1233;
const PLUS_AD_IMAGE_ASPECT_RATIO =
  plusAdImageAsset.width > 0 && plusAdImageAsset.height > 0
    ? plusAdImageAsset.width / plusAdImageAsset.height
    : PLUS_AD_IMAGE_DEFAULT_ASPECT_RATIO;

type PlusAdImageProps = {
  accessibilityLabel?: string;
  width?: DimensionValue;
};

/** Strollia Plus機能比較広告のPNG画像。 */
export function PlusAdImage({ accessibilityLabel, width = '100%' }: PlusAdImageProps) {
  const [frameWidth, setFrameWidth] = useState(0);
  const imageSize = {
    width: frameWidth,
    height: frameWidth / PLUS_AD_IMAGE_ASPECT_RATIO,
  };

  return (
    <View
      style={{ width }}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        setFrameWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
      }}
    >
      <Image
        accessibilityLabel={accessibilityLabel}
        resizeMode="contain"
        source={PLUS_AD_IMAGE_SOURCE}
        style={[{ resizeMode: 'contain' }, imageSize]}
      />
    </View>
  );
}
