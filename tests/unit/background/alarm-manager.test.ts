import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerDailyAlarm, applyAlarm } from '../../../src/background/alarm-manager.js';
import { ALARM_NAMES, ALARM_PERIOD_MINUTES } from '../../../src/shared/constants.js';

// @types/chrome의 alarms.get 마지막 오버로드가 Promise<Alarm> (undefined 불허)이므로
// 실제 동작(알람 없으면 undefined 반환)을 테스트하기 위해 캐스트
type AlarmsGetFn = (name?: string) => Promise<chrome.alarms.Alarm | undefined>;
const mockAlarmsGet = vi.mocked(chrome.alarms.get as unknown as AlarmsGetFn);

describe('registerDailyAlarm()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('알람이 없으면 새로 생성', async () => {
    mockAlarmsGet.mockResolvedValue(undefined);
    vi.mocked(chrome.alarms.create).mockResolvedValue(undefined);

    await registerDailyAlarm();

    expect(chrome.alarms.create).toHaveBeenCalledWith(ALARM_NAMES.DAILY_PRICE_CHECK, {
      periodInMinutes: ALARM_PERIOD_MINUTES,
      delayInMinutes: 1,
    });
  });

  it('이미 알람이 있으면 생성하지 않음', async () => {
    mockAlarmsGet.mockResolvedValue({
      name: ALARM_NAMES.DAILY_PRICE_CHECK,
      scheduledTime: Date.now() + 60_000,
      periodInMinutes: ALARM_PERIOD_MINUTES,
    });

    await registerDailyAlarm();

    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });
});

describe('applyAlarm()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chrome.alarms.clear).mockResolvedValue(undefined);
    vi.mocked(chrome.alarms.create).mockResolvedValue(undefined);
  });

  it('주기 분 수를 전달하면 기존 알람을 지우고 새로 생성한다', async () => {
    await applyAlarm(360); // 6시간

    expect(chrome.alarms.clear).toHaveBeenCalledWith(ALARM_NAMES.DAILY_PRICE_CHECK);
    expect(chrome.alarms.create).toHaveBeenCalledWith(ALARM_NAMES.DAILY_PRICE_CHECK, {
      periodInMinutes: 360,
      delayInMinutes: 1,
    });
  });

  it('null(일시정지)이면 알람을 삭제하고 생성하지 않는다', async () => {
    await applyAlarm(null);

    expect(chrome.alarms.clear).toHaveBeenCalledWith(ALARM_NAMES.DAILY_PRICE_CHECK);
    expect(chrome.alarms.create).not.toHaveBeenCalled();
  });
});
