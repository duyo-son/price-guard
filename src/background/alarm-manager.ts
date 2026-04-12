import { ALARM_NAMES, ALARM_PERIOD_MINUTES } from '../shared/constants.js';

export async function registerDailyAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(ALARM_NAMES.DAILY_PRICE_CHECK);
  if (!existing) {
    await chrome.alarms.create(ALARM_NAMES.DAILY_PRICE_CHECK, {
      periodInMinutes: ALARM_PERIOD_MINUTES,
      delayInMinutes: 1,
    });
  }
}

/** 주기를 지정해 알람을 (재)생성한다. periodMinutes=null 이면 알람을 삭제(일시정지). */
export async function applyAlarm(periodMinutes: number | null): Promise<void> {
  await chrome.alarms.clear(ALARM_NAMES.DAILY_PRICE_CHECK);
  if (periodMinutes === null) return;
  await chrome.alarms.create(ALARM_NAMES.DAILY_PRICE_CHECK, {
    periodInMinutes: periodMinutes,
    delayInMinutes: 1,
  });
}

export function onAlarmFired(alarmName: string, handler: () => Promise<void>): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === alarmName) {
      handler().catch((err: unknown) => console.error('[PriceGuard] Alarm handler error:', err));
    }
  });
}
