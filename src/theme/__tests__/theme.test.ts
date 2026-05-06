import { darkTheme, getAppTheme, lightTheme } from '../theme';

describe('テーマ選択 getAppTheme', () => {
  it('OSがダークモードでない場合はライトテーマを返す', () => {
    expect(getAppTheme('light')).toBe(lightTheme);
    expect(getAppTheme(null)).toBe(lightTheme);
  });

  it('OSがダークモードの場合はダークテーマを返す', () => {
    expect(getAppTheme('dark')).toBe(darkTheme);
  });
});
