import { resolveRouteLineStyle, resolveUserLocationIcon } from '../customizationResolver';

describe('カスタマイズ反映 customizationResolver', () => {
  it('無課金時のルート線は現在テーマのクラシック表示を使う', () => {
    expect(resolveRouteLineStyle('glow', false, '#123456')).toEqual({
      color: '#123456',
      width: 5,
      glow: false,
    });
  });

  it('Plus有効時は選択したルート線スタイルを使う', () => {
    expect(resolveRouteLineStyle('glow', true, '#123456')).toEqual({
      color: '#73c7a2',
      width: 6,
      glow: true,
    });
  });

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
