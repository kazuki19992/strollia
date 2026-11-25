/** 年次レポートJSON(payload)の現行形式バージョン。形式を変えるときはこの値を上げ、表示側で互換を判断する。 */
export const ANNUAL_REPORT_PAYLOAD_VERSION = 1;

/** 緯度経度。 */
export type AnnualReportCoordinate = { latitude: number; longitude: number };

/** 記録時刻付きの座標(最遠日ルートの再生用)。 */
export type AnnualReportTimedCoordinate = AnnualReportCoordinate & { recordedAt: string };

/**
 * マスのセル番号 [x, y]。Web Mercator のメートル座標を `cellSizeMeters` で割った番号で、地図画面の visited grid と同じ座標系。
 */
export type AnnualReportAreaCellIndex = [number, number];

/** 「新しく塗ったエリア」ページの地図に描くマス。 */
export type AnnualReportAreaMap = {
  /** マスの一辺。地図画面と同じ段階(100m〜10km)から、新しいマスが150個以下になる最小の段階。 */
  cellSizeMeters: number;
  /** 集計期間内に初めて塗ったマス(最大150個)。初訪問の古い順で、塗る演出の順番に使う。 */
  newCells: AnnualReportAreaCellIndex[];
  /** 新しいマスを囲む範囲にある、期間開始前までに塗られていたマス(最大150個)。newCells と同じ番号は含まない。 */
  previousCells: AnnualReportAreaCellIndex[];
};

/** 完成した年次レポート本体(payload_version 1)。表示内容が毎年変わりうるためカラムに分けずJSONで保存する。 */
export type AnnualReportPayloadV1 = {
  version: 1;
  year: number;
  /** 集計期間の開始日(YYYY-MM-DD)。 */
  periodStart: string;
  /** 集計期間の終了日(YYYY-MM-DD)。 */
  periodEnd: string;
  activeDays: number;
  /** 記録のある日(カレンダー表示用)。 */
  activeDates: string[];
  totalDistanceMeters: number;
  /** 月別移動距離。長さ12。 */
  monthlyDistanceMeters: number[];
  /** 1年分の間引き済みルート。日をまたいでつながない。 */
  yearRouteSegments: AnnualReportCoordinate[][];
  farthestDay: { localDate: string; distanceMeters: number; route: AnnualReportTimedCoordinate[] } | null;
  /** その年に訪れた都道府県(チップ表示用)。 */
  visitedPrefectures: string[];
  /** その年に初訪問した都道府県。 */
  newPrefectures: string[];
  newMunicipalityCount: number;
  newCellCount: number;
  /** 期間開始前までに塗られていたエリア数。 */
  previousCellCount: number;
  /**
   * 地図に描く新しく塗ったマス。新しいマスが0個なら null。
   * この項目を追加する前に保存された payload には無いため省略可能にしている(表示側は地図なしで出す)。
   */
  newAreaMap?: AnnualReportAreaMap | null;
  /** 最大3件、新しい順。 */
  achievements: { count: number; highlights: { id: string; unlockedLocalDate: string }[] };
  /** 最大3件、新しい順。 */
  spots: { count: number; highlights: { id: string; visitedLocalDate: string }[] };
};

/** 集計途中の進捗。ステップ分割集計を中断しても途中から再開できるよう保存する。 */
export type AnnualReportProgress = {
  /** 1〜12は次に集計する月、13は最終ステップ待ち。 */
  nextMonth: number;
  /**
   * 次に集計する、月の前半(1: 1〜15日)・後半(2: 16日〜月末)。
   * 1ステップの読み込み量を抑えるため月を半分に分けている。
   * 半月分割より前の進捗には無いため省略可能にし、無ければ前半(その月の最初)から再開する。
   */
  nextHalf?: 1 | 2;
  activeDates: string[];
  monthlyDistanceMeters: number[];
  yearRouteSegments: AnnualReportCoordinate[][];
  farthestCandidate: { localDate: string; distanceMeters: number } | null;
};

/** `annual_reports` の1行を復元したレコード。statusで中身(progress / payload)が判別できる。 */
export type AnnualReportRecord =
  | { year: number; status: 'in_progress'; progress: AnnualReportProgress; notificationScheduledAt: string | null }
  | { year: number; status: 'completed'; payload: AnnualReportPayloadV1; notificationScheduledAt: string | null };
