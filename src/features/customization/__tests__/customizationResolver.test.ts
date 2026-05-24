import { resolveUserLocationIcon } from '../customizationResolver';

describe('カスタマイズ反映 customizationResolver', () => {
  it('無課金時の現在地アイコンはOS標準を使う', () => {
    expect(resolveUserLocationIcon('walker', false)).toEqual({
      useNativeUserLocation: true,
      customIconId: null,
    });
  });

  it('Plus有効時は独自現在地アイコンへ切り替えられる', () => {
    expect(resolveUserLocationIcon('walker', true)).toEqual({
      useNativeUserLocation: false,
      customIconId: 'walker',
    });
  });
});
