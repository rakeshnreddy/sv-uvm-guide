/**
 * Local calendar days for streaks, activity and flashcard due dates.
 *
 * A day is 'YYYY-MM-DD' in the learner's local time zone, computed from the
 * browser clock. Changing the clock or the time zone (travel, DST edge cases,
 * a manual clock change) can move an activity or a due date to a neighbouring
 * day; that is accepted, because the data lives in one browser and there is
 * no server clock to compare against.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 'YYYY-MM-DD' for the local day containing `ms`. */
export function localDayKey(ms: number = Date.now()): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local midnight at the start of the day containing `ms`. */
export function startOfLocalDay(ms: number = Date.now()): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** The last millisecond of the local day containing `ms`. */
export function endOfLocalDay(ms: number = Date.now()): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1;
}

/** `ms` moved by whole calendar days (negative goes back), keeping the local time of day across DST changes. */
export function addDays(ms: number, days: number): number {
  const date = new Date(ms);
  date.setDate(date.getDate() + Math.trunc(days));
  return date.getTime();
}

/** True for a well-formed 'YYYY-MM-DD' key naming a real calendar date. */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DAY_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Local midnight of a 'YYYY-MM-DD' key, or null when the key is malformed. */
export function dayKeyToMs(key: string): number | null {
  if (!isDayKey(key)) return null;
  const match = DAY_KEY_PATTERN.exec(key) as RegExpExecArray;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

/**
 * Every local day key from the day containing `startMs` to the day containing
 * `endMs`, both included, oldest first. Empty when `endMs` is before `startMs`.
 */
export function dayKeysBetween(startMs: number, endMs: number): string[] {
  const keys: string[] = [];
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return keys;
  const last = startOfLocalDay(endMs);
  for (let day = startOfLocalDay(startMs); day <= last; day = startOfLocalDay(addDays(day, 1))) {
    keys.push(localDayKey(day));
  }
  return keys;
}
