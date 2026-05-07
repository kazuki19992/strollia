import { ACHIEVEMENT_DEFINITIONS, STROLLIA_APP_STORE_URL, createAchievementShareText, formatAchievementDistance } from '../achievementDefinitions';

describe('実績定義 achievementDefinitions', () => {
  it('距離表記をメートルとキロメートルで整形する', () => {
    expect(formatAchievementDistance(750)).toBe('750m');
    expect(formatAchievementDistance(1000)).toBe('1km');
    expect(formatAchievementDistance(7500)).toBe('7.5km');
  });

  it('画像ファイルに対応するログ記録日数実績を持つ', () => {
    expect(ACHIEVEMENT_DEFINITIONS.filter((definition) => definition.category === 'logDays').map((definition) => definition.id)).toEqual([
      'log-days-1',
      'log-days-7',
      'log-days-31',
      'log-days-365',
      'log-days-730',
      'log-days-1000',
    ]);
  });

  it('共有文言を共通テンプレートから生成する', () => {
    expect(createAchievementShareText('はじめの一歩')).toBe(
      `すとろりあではじめの一歩を達成しました！\n\n今すぐダウンロード\n${STROLLIA_APP_STORE_URL}\n#すとろりあ\n#Strollia\n#おさんぽログ`,
    );
  });

  it('あとから追加しやすい固定IDをカテゴリ別に持つ', () => {
    expect(ACHIEVEMENT_DEFINITIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'distance-100', category: 'distance' }),
        expect.objectContaining({ id: 'distance-earth-40000', category: 'distance' }),
        expect.objectContaining({ id: 'prefectures-47', category: 'prefecture' }),
        expect.objectContaining({ id: 'cities-1000', category: 'municipality' }),
      ]),
    );
  });
});
