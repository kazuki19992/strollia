import { darkTheme, getAppTheme, lightTheme } from '../theme';

describe('getAppTheme', () => {
  it('uses light theme unless OS requests dark', () => {
    expect(getAppTheme('light')).toBe(lightTheme);
    expect(getAppTheme(null)).toBe(lightTheme);
  });

  it('uses dark theme for dark OS setting', () => {
    expect(getAppTheme('dark')).toBe(darkTheme);
  });
});
