import { resolveUserLocationIcon } from '@/features/customization/customizationResolver';

describe('カスタマイズ反映 customizationResolver', () => {
  it('無課金時の現在地アイコンはOS標準を使う', () => {
    expect(resolveUserLocationIcon('walker', false, null)).toEqual({
      useNativeUserLocation: true,
      customIconId: null,
      customImageUri: null,
    });
  });

  it('Plus有効時は独自現在地アイコンへ切り替えられる', () => {
    expect(resolveUserLocationIcon('walker', true, null)).toEqual({
      useNativeUserLocation: false,
      customIconId: 'walker',
      customImageUri: null,
    });
  });

  it('customかつURIありPlusActiveのとき customImageUri を返す', () => {
    expect(resolveUserLocationIcon('custom', true, 'file:///tmp/icon.jpg')).toEqual({
      useNativeUserLocation: false,
      customIconId: null,
      customImageUri: 'file:///tmp/icon.jpg',
    });
  });

  it('customかつURIなしのときOS標準へフォールバックする', () => {
    expect(resolveUserLocationIcon('custom', true, null)).toEqual({
      useNativeUserLocation: true,
      customIconId: null,
      customImageUri: null,
    });
  });

  it('customかつPlus非加入のときOS標準へフォールバックする', () => {
    expect(resolveUserLocationIcon('custom', false, 'file:///tmp/icon.jpg')).toEqual({
      useNativeUserLocation: true,
      customIconId: null,
      customImageUri: null,
    });
  });
});
