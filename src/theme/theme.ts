export type AppThemeName = 'light' | 'dark';

export type AppTheme = {
  name: AppThemeName;
  colors: {
    background: string;
    card: string;
    cardStrong: string;
    text: string;
    mutedText: string;
    border: string;
    primary: string;
    primaryText: string;
    danger: string;
    dangerSurface: string;
    mapLine: string;
    surfaceOverlay: string;
    scrim: string;
    shadow: string;
  };
};

export const lightTheme: AppTheme = {
  name: 'light',
  colors: {
    background: '#f4ead8',
    card: '#fffdf8',
    cardStrong: '#fffdf8',
    text: '#2d2416',
    mutedText: '#675c4d',
    border: '#e5ddcd',
    primary: '#1f7a5c',
    primaryText: '#fffdf8',
    danger: '#b33f52',
    dangerSurface: '#fff1f3',
    mapLine: '#1f7a5c',
    surfaceOverlay: 'rgba(255, 253, 248, 0.94)',
    scrim: 'rgba(45, 36, 22, 0.08)',
    shadow: '#2d2416',
  },
};

export const darkTheme: AppTheme = {
  name: 'dark',
  colors: {
    background: '#151811',
    card: '#22261d',
    cardStrong: '#2b3025',
    text: '#f3eadb',
    mutedText: '#c8bda7',
    border: '#3a4032',
    primary: '#73c7a2',
    primaryText: '#102018',
    danger: '#ff8899',
    dangerSurface: '#3a2028',
    mapLine: '#73c7a2',
    surfaceOverlay: 'rgba(34, 38, 29, 0.94)',
    scrim: 'rgba(0, 0, 0, 0.28)',
    shadow: '#000000',
  },
};

export function getAppTheme(colorScheme: 'light' | 'dark' | null | undefined): AppTheme {
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}
