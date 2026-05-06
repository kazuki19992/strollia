import {
  getAvailableCustomizationOptions,
  getRouteLineStyleOption,
  getUserLocationIconOption,
  ROUTE_LINE_STYLE_OPTIONS,
  USER_LOCATION_ICON_OPTIONS,
} from '../customizationOptions';

describe('カスタマイズ選択肢 customizationOptions', () => {
  it('Plus無効時は無料項目だけを返す', () => {
    const availableOptions = getAvailableCustomizationOptions(ROUTE_LINE_STYLE_OPTIONS, false);

    expect(availableOptions).toEqual([expect.objectContaining({ id: 'classic', premium: false })]);
  });

  it('Plus有効時は有料項目も返す', () => {
    const availableOptions = getAvailableCustomizationOptions(ROUTE_LINE_STYLE_OPTIONS, true);

    expect(availableOptions.map((option) => option.id)).toEqual(['classic', 'glow', 'bold']);
  });

  it('未知のルート線IDはクラシックへフォールバックする', () => {
    expect(getRouteLineStyleOption('unknown' as never)).toEqual(expect.objectContaining({ id: 'classic' }));
  });

  it('未知の現在地アイコンIDはOS標準へフォールバックする', () => {
    expect(getUserLocationIconOption('unknown' as never)).toEqual(expect.objectContaining({ id: 'default' }));
  });

  it('現在地アイコンもPlus無効時は無料項目だけを返す', () => {
    const availableOptions = getAvailableCustomizationOptions(USER_LOCATION_ICON_OPTIONS, false);

    expect(availableOptions).toEqual([expect.objectContaining({ id: 'default', premium: false })]);
  });
});
