import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = process.env.APP_TIMEZONE || 'Europe/Moscow';

export function nowUtc(): string {
  return dayjs.utc().toISOString();
}

export function nowMsk(): string {
  return dayjs().tz(DEFAULT_TZ).format();
}

export function toMsk(date: string | Date | null | undefined): dayjs.Dayjs | null {
  if (!date) return null;
  return dayjs(date).tz(DEFAULT_TZ);
}

export function daysDiff(a: Date | string, b: Date | string): number {
  const da = dayjs(a);
  const db = dayjs(b);
  return Math.round(da.diff(db, 'day', true));
}

export function parseYmd(dateStr: string): Date {
  // YYYY-MM-DD as local date start of day in TZ
  return dayjs.tz(dateStr, DEFAULT_TZ).startOf('day').toDate();
}

