type DevelopmentFlagsModule = typeof import('@/config/developmentFlags');

/** 読み直しのたびに退避・復元する開発用環境変数の一覧。 */
const DEVELOPMENT_FLAG_ENV_NAMES = [
  'EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT',
  'EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH',
  'EXPO_PUBLIC_LOG_VISITED_GRID_METRICS',
  'EXPO_PUBLIC_LOG_PHOTO_SCAN_METRICS',
  'EXPO_PUBLIC_PHOTO_SCAN_LIMIT',
] as const;

/** process.envに値を設定し、undefinedなら削除する。 */
function setEnvValue(name: string, value: string | undefined): void {
  if (value == null) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

/** 環境変数を反映した状態で開発フラグモジュールを読み直す。 */
function loadDevelopmentFlagsModule(env: Record<string, string | undefined>): DevelopmentFlagsModule {
  // 読み込み後に元の値へ戻し、テスト間で環境変数を持ち越さない
  const originalValues = DEVELOPMENT_FLAG_ENV_NAMES.map((name) => [name, process.env[name]] as const);

  DEVELOPMENT_FLAG_ENV_NAMES.forEach((name) => {
    setEnvValue(name, env[name]);
  });
  jest.resetModules();
  const loadedModule = require('../developmentFlags') as DevelopmentFlagsModule;
  originalValues.forEach(([name, value]) => {
    setEnvValue(name, value);
  });

  return loadedModule;
}

describe('開発用フラグ developmentFlags', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('既定では開発用フラグを無効にする', () => {
    const { hasEnabledDevelopmentFlags, shouldResetAchievementsOnLaunch } = loadDevelopmentFlagsModule({});

    expect(hasEnabledDevelopmentFlags()).toBe(false);
    expect(shouldResetAchievementsOnLaunch()).toBe(false);
  });

  it('環境変数でPlus仮有効化フラグを有効にできる', () => {
    const { developmentFlags, hasEnabledDevelopmentFlags } = loadDevelopmentFlagsModule({
      EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT: 'true',
    });

    expect(developmentFlags.enablePremiumAccessWithoutRevenueCat).toBe(true);
    expect(hasEnabledDevelopmentFlags()).toBe(true);
  });

  it('環境変数でVisited Grid計測ログを有効にできる', () => {
    const { developmentFlags, hasEnabledDevelopmentFlags } = loadDevelopmentFlagsModule({
      EXPO_PUBLIC_LOG_VISITED_GRID_METRICS: 'true',
    });

    expect(developmentFlags.logVisitedGridMetrics).toBe(true);
    expect(hasEnabledDevelopmentFlags()).toBe(true);
  });

  it('環境変数で起動時実績リセット判定を有効にできる', () => {
    const { shouldResetAchievementsOnLaunch } = loadDevelopmentFlagsModule({
      EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH: 'true',
    });

    expect(shouldResetAchievementsOnLaunch()).toBe(true);
  });

  it('環境変数で写真走査の計測表示を有効にできる', () => {
    const { developmentFlags, hasEnabledDevelopmentFlags } = loadDevelopmentFlagsModule({
      EXPO_PUBLIC_LOG_PHOTO_SCAN_METRICS: 'true',
    });

    expect(developmentFlags.logPhotoScanMetrics).toBe(true);
    expect(hasEnabledDevelopmentFlags()).toBe(true);
  });

  it('既定では写真走査の計測表示を無効にする', () => {
    const { developmentFlags } = loadDevelopmentFlagsModule({});

    expect(developmentFlags.logPhotoScanMetrics).toBe(false);
  });
});

describe('写真走査上限の上書き getPhotoScanLimitOverride', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('環境変数に正の数値を設定した場合はその値を返す', () => {
    const { getPhotoScanLimitOverride } = loadDevelopmentFlagsModule({ EXPO_PUBLIC_PHOTO_SCAN_LIMIT: '2000' });

    expect(getPhotoScanLimitOverride()).toBe(2000);
  });

  it('上書きを設定した場合は開発フラグ有効として扱う', () => {
    const { hasEnabledDevelopmentFlags } = loadDevelopmentFlagsModule({ EXPO_PUBLIC_PHOTO_SCAN_LIMIT: '2000' });

    expect(hasEnabledDevelopmentFlags()).toBe(true);
  });

  it('未設定の場合はnullを返す(既定の上限を使う)', () => {
    const { getPhotoScanLimitOverride } = loadDevelopmentFlagsModule({});

    expect(getPhotoScanLimitOverride()).toBeNull();
  });

  it('空文字の場合はnullを返す', () => {
    const { getPhotoScanLimitOverride } = loadDevelopmentFlagsModule({ EXPO_PUBLIC_PHOTO_SCAN_LIMIT: '' });

    expect(getPhotoScanLimitOverride()).toBeNull();
  });

  it('数値として解釈できない場合はnullを返す', () => {
    const { getPhotoScanLimitOverride } = loadDevelopmentFlagsModule({ EXPO_PUBLIC_PHOTO_SCAN_LIMIT: 'たくさん' });

    expect(getPhotoScanLimitOverride()).toBeNull();
  });

  it('0以下の場合はnullを返す', () => {
    expect(loadDevelopmentFlagsModule({ EXPO_PUBLIC_PHOTO_SCAN_LIMIT: '0' }).getPhotoScanLimitOverride()).toBeNull();
    expect(loadDevelopmentFlagsModule({ EXPO_PUBLIC_PHOTO_SCAN_LIMIT: '-100' }).getPhotoScanLimitOverride()).toBeNull();
  });

  it('小数を設定した場合は切り捨てた整数として扱う', () => {
    const { getPhotoScanLimitOverride } = loadDevelopmentFlagsModule({ EXPO_PUBLIC_PHOTO_SCAN_LIMIT: '1500.7' });

    expect(getPhotoScanLimitOverride()).toBe(1500);
  });
});
