import {
  getAvailableCustomizationOptions,
  getUserLocationIconOption,
  USER_LOCATION_ICON_OPTIONS,
} from '../customizationOptions';

describe('カスタマイズ選択肢 customizationOptions', () => {
  it('現在地アイコンはPlus無効時に無料項目だけを返す', () => {
    const availableOptions = getAvailableCustomizationOptions(USER_LOCATION_ICON_OPTIONS, false);

    expect(availableOptions).toEqual([expect.objectContaining({ id: 'default', premium: false })]);
  });

  it('現在地アイコンはPlus有効時に有料項目も返す', () => {
    const availableOptions = getAvailableCustomizationOptions(USER_LOCATION_ICON_OPTIONS, true);

    expect(availableOptions.map((option) => option.id)).toEqual(['default', 'walker', 'compass']);
  });

  it('未知の現在地アイコンIDはOS標準へフォールバックする', () => {
    expect(getUserLocationIconOption('unknown' as never)).toEqual(expect.objectContaining({ id: 'default' }));
  });
});
