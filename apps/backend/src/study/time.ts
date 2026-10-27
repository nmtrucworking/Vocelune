import { DateTime } from 'luxon';
export function studyDate(now: Date, timezone: string, dayStartHour: number) {
  const local = DateTime.fromJSDate(now).setZone(timezone);
  return (local.hour < dayStartHour ? local.minus({ days: 1 }) : local).toISODate()!;
}
export function studyDayStart(now: Date, timezone: string, dayStartHour: number) {
  const date = studyDate(now, timezone, dayStartHour);
  return DateTime.fromISO(date, { zone: timezone }).startOf('day').set({ hour: dayStartHour }).toJSDate();
}
export function nextStudyDay(now: Date, timezone: string, dayStartHour: number) {
  return DateTime.fromJSDate(studyDayStart(now, timezone, dayStartHour)).setZone(timezone).plus({ days: 1 }).toJSDate();
}
