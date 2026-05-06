/** 端末のローカルタイムゾーンで日別ログ用のYYYY-MM-DD文字列を作る。 */
export function toLocalDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** ISO日時文字列を画面表示用の時刻へ変換する。 */
export function formatTime(value: string | null): string {
  if (!value) {
    return '--:--';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}
