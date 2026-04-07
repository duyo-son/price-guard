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

export function onAlarmFired(alarmName: string, handler: () => Promise<void>): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === alarmName) {
      handler().catch((err: unknown) => console.error('[PriceGuard] Alarm handler error:', err));
    }
  });
}
