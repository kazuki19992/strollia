/**
 * スポットの都道府県コードから日本語表記への変換表。
 *
 * キーは `data/landmarks/landmarkSpots.schema.json` の `prefecture` enum と同じ47件。
 * マスタ側をコード(`TOCHIGI`)で持つのは、表示名の変更や表記ゆれがマスタへ波及しないようにするためで、
 * 日本語表記はUI層に近いこの表だけで面倒を見る。
 */
const LANDMARK_PREFECTURE_LABELS: Readonly<Record<string, string | undefined>> = {
  HOKKAIDO: '北海道',
  AOMORI: '青森県',
  IWATE: '岩手県',
  MIYAGI: '宮城県',
  AKITA: '秋田県',
  YAMAGATA: '山形県',
  FUKUSHIMA: '福島県',
  IBARAKI: '茨城県',
  TOCHIGI: '栃木県',
  GUNMA: '群馬県',
  SAITAMA: '埼玉県',
  CHIBA: '千葉県',
  TOKYO: '東京都',
  KANAGAWA: '神奈川県',
  NIIGATA: '新潟県',
  TOYAMA: '富山県',
  ISHIKAWA: '石川県',
  FUKUI: '福井県',
  YAMANASHI: '山梨県',
  NAGANO: '長野県',
  GIFU: '岐阜県',
  SHIZUOKA: '静岡県',
  AICHI: '愛知県',
  MIE: '三重県',
  SHIGA: '滋賀県',
  KYOTO: '京都府',
  OSAKA: '大阪府',
  HYOGO: '兵庫県',
  NARA: '奈良県',
  WAKAYAMA: '和歌山県',
  TOTTORI: '鳥取県',
  SHIMANE: '島根県',
  OKAYAMA: '岡山県',
  HIROSHIMA: '広島県',
  YAMAGUCHI: '山口県',
  TOKUSHIMA: '徳島県',
  KAGAWA: '香川県',
  EHIME: '愛媛県',
  KOCHI: '高知県',
  FUKUOKA: '福岡県',
  SAGA: '佐賀県',
  NAGASAKI: '長崎県',
  KUMAMOTO: '熊本県',
  OITA: '大分県',
  MIYAZAKI: '宮崎県',
  KAGOSHIMA: '鹿児島県',
  OKINAWA: '沖縄県',
};

/**
 * スポットの都道府県コードを日本語表記へ変換する。
 *
 * マスタのコードはJSON Schemaのenumで47都道府県に制限しているため、通常は必ず表に載っている。
 * それでも見つからない場合は、行から情報が消えて原因が追えなくなるのを避けるため、
 * 例外を投げずにコードをそのまま返す。
 *
 * @param prefecture - スポットの `prefecture`(大文字スネークケースのコード)。
 * @returns 日本語表記の都道府県名。未知のコードは引数をそのまま返す。
 */
export function getLandmarkPrefectureLabel(prefecture: string): string {
  return LANDMARK_PREFECTURE_LABELS[prefecture] ?? prefecture;
}

/**
 * 都道府県コードの配列を表示用の文字列へ結合する。
 *
 * 富士山のように複数都道府県にまたがるスポットは「山梨県・静岡県」のように
 * 中黒(・)で連結する。配列の並び順はデータ側の意図(主要な県を先に書くなど)を
 * そのまま尊重し、ここでは並べ替えない。未知のコードが混ざった場合の扱いは
 * `getLandmarkPrefectureLabel` に委ねる(コードをそのまま連結する)。
 *
 * @param codes - スポットの `prefectures`(大文字スネークケースのコード配列)。
 * @returns 中黒区切りの日本語表記。
 */
export function formatLandmarkPrefectures(codes: readonly string[]): string {
  return codes.map((code) => getLandmarkPrefectureLabel(code)).join('・');
}
