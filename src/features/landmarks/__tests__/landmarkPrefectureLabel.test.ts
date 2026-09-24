import { LANDMARK_SPOTS } from '@/features/landmarks/landmarkCatalog';
import { getLandmarkPrefectureLabel } from '@/features/landmarks/landmarkPrefectureLabel';

/**
 * 都道府県コードと日本語表記の期待値。
 *
 * data/landmarks/landmarkSpots.schema.json の prefecture enum と同じ47件を、
 * 並び順(北から南)まで含めてそのまま書き出している。
 * 表を実装から独立して持つことで、変換表の取りこぼしや誤りを検出できる。
 */
const EXPECTED_LABELS: readonly [string, string][] = [
  ['HOKKAIDO', '北海道'],
  ['AOMORI', '青森県'],
  ['IWATE', '岩手県'],
  ['MIYAGI', '宮城県'],
  ['AKITA', '秋田県'],
  ['YAMAGATA', '山形県'],
  ['FUKUSHIMA', '福島県'],
  ['IBARAKI', '茨城県'],
  ['TOCHIGI', '栃木県'],
  ['GUNMA', '群馬県'],
  ['SAITAMA', '埼玉県'],
  ['CHIBA', '千葉県'],
  ['TOKYO', '東京都'],
  ['KANAGAWA', '神奈川県'],
  ['NIIGATA', '新潟県'],
  ['TOYAMA', '富山県'],
  ['ISHIKAWA', '石川県'],
  ['FUKUI', '福井県'],
  ['YAMANASHI', '山梨県'],
  ['NAGANO', '長野県'],
  ['GIFU', '岐阜県'],
  ['SHIZUOKA', '静岡県'],
  ['AICHI', '愛知県'],
  ['MIE', '三重県'],
  ['SHIGA', '滋賀県'],
  ['KYOTO', '京都府'],
  ['OSAKA', '大阪府'],
  ['HYOGO', '兵庫県'],
  ['NARA', '奈良県'],
  ['WAKAYAMA', '和歌山県'],
  ['TOTTORI', '鳥取県'],
  ['SHIMANE', '島根県'],
  ['OKAYAMA', '岡山県'],
  ['HIROSHIMA', '広島県'],
  ['YAMAGUCHI', '山口県'],
  ['TOKUSHIMA', '徳島県'],
  ['KAGAWA', '香川県'],
  ['EHIME', '愛媛県'],
  ['KOCHI', '高知県'],
  ['FUKUOKA', '福岡県'],
  ['SAGA', '佐賀県'],
  ['NAGASAKI', '長崎県'],
  ['KUMAMOTO', '熊本県'],
  ['OITA', '大分県'],
  ['MIYAZAKI', '宮崎県'],
  ['KAGOSHIMA', '鹿児島県'],
  ['OKINAWA', '沖縄県'],
];

describe('都道府県ラベル getLandmarkPrefectureLabel', () => {
  it('47都道府県すべてのコードを日本語表記へ変換する', () => {
    expect(EXPECTED_LABELS).toHaveLength(47);

    for (const [code, label] of EXPECTED_LABELS) {
      expect(getLandmarkPrefectureLabel(code)).toBe(label);
    }
  });

  it('都・道・府・県の区別を正しく付ける', () => {
    expect(getLandmarkPrefectureLabel('HOKKAIDO')).toBe('北海道');
    expect(getLandmarkPrefectureLabel('TOKYO')).toBe('東京都');
    expect(getLandmarkPrefectureLabel('KYOTO')).toBe('京都府');
    expect(getLandmarkPrefectureLabel('OSAKA')).toBe('大阪府');
    expect(getLandmarkPrefectureLabel('IBARAKI')).toBe('茨城県');
  });

  it('未知のコードは画面から情報が消えないようコードをそのまま返す', () => {
    expect(getLandmarkPrefectureLabel('UNKNOWN_PREFECTURE')).toBe('UNKNOWN_PREFECTURE');
    expect(getLandmarkPrefectureLabel('')).toBe('');
  });

  it('マスタに登録済みのスポットはすべて日本語表記へ変換できる', () => {
    for (const spot of LANDMARK_SPOTS) {
      expect(getLandmarkPrefectureLabel(spot.prefecture)).not.toBe(spot.prefecture);
    }
  });
});
