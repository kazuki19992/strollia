/** ルートライブラリを使わない単一App内の簡易画面状態。 */
export type ScreenMode = 'map' | 'dailyLogs' | 'achievements' | 'settings';

/** 自動GPS記録の開始状態をユーザー向け文言へ変換するための状態。 */
export type AutoStartStatus = 'checking' | 'recording' | 'needsPermission' | 'failed';
