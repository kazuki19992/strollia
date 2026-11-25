import { toLocalDate } from '@/utils/date';

/** 年間レポートを作成する最小の記録日数。これ未満の年はレポートを作らない。 */
export const MIN_ACTIVE_DAYS = 7;

/** 開発用フラグ有効時に、完了から通知までに空ける秒数。通知タップの流れを手早く確認するため。 */
const DEV_NOTIFICATION_DELAY_SECONDS = 10;

/** 年間レポートの集計対象。日付は端末ローカルの `YYYY-MM-DD`。 */
export type AnnualReportWindow = {
  /** 対象年。 */
  year: number;
  /** 集計期間の開始日(対象年の1月1日)。 */
  periodStart: string;
  /** 集計期間の終了日(通常は12月15日。開発用フラグ時は今日と12月15日の早い方)。 */
  periodEnd: string;
  /** 公開期間の終了時刻(翌年1月15日の23:59:59.999)。 */
  publishEnd: Date;
};

/** 公開期間の終了時刻(翌年1月15日の最後のミリ秒)を作る。 */
function createPublishEnd(year: number): Date {
  return new Date(year + 1, 0, 15, 23, 59, 59, 999);
}

/** 公開期間の開始時刻(12月20日0:00)を作る。 */
function createPublishStart(year: number): Date {
  return new Date(year, 11, 20, 0, 0, 0, 0);
}

/**
 * 集計を起動してよい期間なら対象を返す。
 *
 * 通常は12月16日〜翌年1月15日で、1月は前年を対象にする。1月に初めて開いた人にも前年分を作るためである。
 * 開発用フラグ時は日付に関係なく現在の年を対象にし、集計期間の終わりは今日(12月16日以降は12月15日)にする。
 *
 * @param now - 現在時刻。
 * @param alwaysAvailable - 開発用フラグ(期間外でも動作させる)。
 * @returns 集計対象。起動してはいけない期間ならnull。
 */
export function resolveAggregationWindow(now: Date, alwaysAvailable: boolean): AnnualReportWindow | null {
  const month = now.getMonth();
  const day = now.getDate();

  if (alwaysAvailable) {
    const year = now.getFullYear();
    const periodEndLimit = new Date(year, 11, 15);
    const todayStart = new Date(year, month, day);
    return {
      year,
      periodStart: toLocalDate(new Date(year, 0, 1)),
      periodEnd: toLocalDate(todayStart < periodEndLimit ? todayStart : periodEndLimit),
      publishEnd: createPublishEnd(year),
    };
  }

  let year: number;
  if (month === 11 && day >= 16) {
    year = now.getFullYear();
  } else if (month === 0 && day <= 15) {
    year = now.getFullYear() - 1;
  } else {
    return null;
  }

  return {
    year,
    periodStart: toLocalDate(new Date(year, 0, 1)),
    periodEnd: toLocalDate(new Date(year, 11, 15)),
    publishEnd: createPublishEnd(year),
  };
}

/**
 * 対象年のレポートを公開(閲覧可能)してよい期間か判定する。
 *
 * @param now - 現在時刻。
 * @param year - 対象年。
 * @param alwaysAvailable - 開発用フラグ。有効なら常にtrue。
 */
export function isPublishPeriod(now: Date, year: number, alwaysAvailable: boolean): boolean {
  if (alwaysAvailable) {
    return true;
  }
  return now >= createPublishStart(year) && now <= createPublishEnd(year);
}

/**
 * 公開終了までの残り日数を返す。
 *
 * 時刻ではなくローカル日付の差で数え、終了日当日を1とする(バッジに「あと1日」と出すため)。
 *
 * @param now - 現在時刻。
 * @param publishEnd - 公開期間の終了時刻。
 */
export function daysUntilPublishEnd(now: Date, publishEnd: Date): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = Date.UTC(publishEnd.getFullYear(), publishEnd.getMonth(), publishEnd.getDate());
  // UTC換算にして夏時間などで1日が23/25時間になる影響を避ける
  return Math.round((end - today) / 86_400_000) + 1;
}

/**
 * 完成通知を出す時刻を決める。
 *
 * 公開前(12月20日0:00より前)に完了したら12月20日9:00に予約する。公開後に完了した場合は、
 * すでに見られる状態でアプリ内のボタンで気づけるため通知しない。
 * 開発用フラグ時は動作確認のため完了の10秒後に通知する。
 *
 * @param completedAt - 集計完了時刻。
 * @param year - 対象年。
 * @param alwaysAvailable - 開発用フラグ。
 * @returns 通知時刻。通知しない場合はnull。
 */
export function resolveNotificationTime(completedAt: Date, year: number, alwaysAvailable: boolean): Date | null {
  if (alwaysAvailable) {
    return new Date(completedAt.getTime() + DEV_NOTIFICATION_DELAY_SECONDS * 1000);
  }
  if (completedAt < createPublishStart(year)) {
    return new Date(year, 11, 20, 9, 0, 0, 0);
  }
  return null;
}

/**
 * 記録日数がレポート作成の条件(7日以上)を満たすか判定する。
 *
 * @param activeDays - 集計期間内の記録日数。
 * @param alwaysAvailable - 開発用フラグ。有効なら記録日数を無視してtrue。
 */
export function meetsMinimumActiveDays(activeDays: number, alwaysAvailable: boolean): boolean {
  return alwaysAvailable || activeDays >= MIN_ACTIVE_DAYS;
}
