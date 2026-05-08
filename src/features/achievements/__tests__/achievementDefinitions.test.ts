import {
  ACHIEVEMENT_DEFINITIONS,
  STROLLIA_APP_STORE_URL,
  createAchievementShareText,
  formatAchievementDistance,
  kilometersToMeters,
} from '../achievementDefinitions';

describe('実績定義 achievementDefinitions', () => {
  it('距離表記をkm単位で整形する', () => {
    expect(formatAchievementDistance(100)).toBe('100km');
    expect(formatAchievementDistance(7500)).toBe('7500km');
  });

  it('km単位の画像ファイル名を内部判定用のmへ変換する', () => {
    expect(kilometersToMeters(100)).toBe(100000);
    expect(ACHIEVEMENT_DEFINITIONS.find((definition) => definition.id === 'distance-100')?.condition.threshold).toBe(100000);
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
        expect.objectContaining({ id: 'distance-100', category: 'distance', title: '100km移動した' }),
        expect.objectContaining({ id: 'distance-5000000', category: 'distance', title: '5000000km移動した' }),
        expect.objectContaining({ id: 'distance-7500000', category: 'distance', title: '7500000km移動した' }),
        expect.objectContaining({ id: 'distance-earth-40000', category: 'distance', title: '地球1周した' }),
        expect.objectContaining({ id: 'prefectures-47', category: 'prefecture' }),
        expect.objectContaining({ id: 'cities-1000', category: 'municipality' }),
      ]),
    );
  });

  it('存在しない400万km実績を含まない', () => {
    expect(ACHIEVEMENT_DEFINITIONS.some((definition) => definition.id === 'distance-4000000')).toBe(false);
  });
});
