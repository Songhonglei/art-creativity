import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROGRESS, readProgress, SAVE_KEY, Simulation } from './simulation';
import { encodeSave, openSaveRepository, restoreSaveFile, SAVE_SLOTS, SaveReadError } from './saveRepository';
import { latestWriter } from './latestWriter';
import type { GameStorage } from './storage';
const slot = (level: number, savedAt = 1) => encodeSave({ ...DEFAULT_PROGRESS, level, gender: 'female', skin: level >= 10 ? 'shanghai-paragon' : 'nightwatch' }, savedAt);
function memory() {
  const values = new Map<string, string>(), writes: string[] = [];
  const storage: GameStorage = { label: 'test', get: async key => values.get(key) ?? null, set: async (key, raw) => { writes.push(key); values.set(key, raw); } };
  return { values, writes, storage };
}
describe('独立存档槽与异常恢复', () => {
  it('异常JSON与未知版本不再被当作新档', async () => {
    const { storage, values, writes } = memory(); values.set(SAVE_KEY, '{bad');
    await expect(openSaveRepository(storage)).rejects.toBeInstanceOf(SaveReadError); expect(writes).toEqual([]); expect(values.get(SAVE_KEY)).toBe('{bad');
    expect(() => readProgress(JSON.stringify({ version: 8 }))).toThrow('版本'); expect(readProgress(null).level).toBe(1);
  });
  it('首次迁移保留旧字节，旧版回滚保存不影响v1的等级、外观和性别', async () => {
    const m = memory(), legacy = JSON.stringify({ ...DEFAULT_PROGRESS, level: 5 }); m.values.set(SAVE_KEY, legacy);
    const repo = await openSaveRepository(m.storage); const p = { ...repo.progress, level: 10, gender: 'female' as const, skin: 'shanghai-paragon' as const };
    await repo.save(p); expect(m.values.get(SAVE_SLOTS.migration)).toBe(legacy); expect(m.values.get(SAVE_KEY)).toBe(legacy);
    m.values.set(SAVE_KEY, JSON.stringify({ ...DEFAULT_PROGRESS, level: 5, skin: 'nightwatch' }));
    expect((await openSaveRepository(m.storage)).progress).toMatchObject({ level: 10, gender: 'female', skin: 'shanghai-paragon' });
  });
  it('损坏主槽自动恢复备份，修复前保护原始字节', async () => {
    const m = memory(); m.values.set(SAVE_SLOTS.primary, '{bad'); m.values.set(SAVE_SLOTS.backup, slot(7));
    const repo = await openSaveRepository(m.storage); expect(repo.progress.level).toBe(7); expect(repo.notice).toContain('备份');
    await repo.save(repo.progress); expect(JSON.parse(m.values.get(SAVE_SLOTS.quarantine)!)[SAVE_SLOTS.primary]).toBe('{bad'); expect(m.writes[0]).toBe(SAVE_SLOTS.quarantine);
  });
  it('选择时间较新的完整副本，容忍单个旧请求晚到', async () => {
    const m = memory(); m.values.set(SAVE_SLOTS.primary, slot(5, 1)); m.values.set(SAVE_SLOTS.backup, slot(10, 2));
    expect((await openSaveRepository(m.storage)).progress.level).toBe(10);
  });
  it('双槽均异常时禁止覆盖，来自未来格式的存档不降级读取', async () => {
    const m = memory(); m.values.set(SAVE_SLOTS.primary, '{bad'); m.values.set(SAVE_SLOTS.backup, '[]');
    await expect(openSaveRepository(m.storage)).rejects.toThrow('保留'); expect(m.writes).toEqual([]);
    m.values.set(SAVE_SLOTS.primary, JSON.stringify({ format: 7 })); m.values.set(SAVE_SLOTS.backup, slot(5));
    await expect(openSaveRepository(m.storage)).rejects.toThrow('其他版本');
    m.values.set(SAVE_SLOTS.primary, JSON.stringify({ format: 1, savedAt: 4, progress: { version: 8 } }));
    await expect(openSaveRepository(m.storage)).rejects.toThrow('其他版本');
  });
  it('有效JSON中的意外字段变化也会触发校验保护', async () => {
    const m = memory(), altered = JSON.parse(slot(10)); altered.progress.cash++;
    m.values.set(SAVE_SLOTS.primary, JSON.stringify(altered));
    await expect(openSaveRepository(m.storage)).rejects.toThrow('保留'); expect(m.writes).toEqual([]);
  });
  it('粘贴恢复先验证，失败不改槽，成功保留原档并能读回', async () => {
    const m = memory(), originals = { [SAVE_SLOTS.primary]: '{bad' };
    await expect(restoreSaveFile(m.storage, '{bad', originals)).rejects.toThrow(); expect(m.writes).toEqual([]);
    await restoreSaveFile(m.storage, slot(10), originals); expect((await openSaveRepository(m.storage)).progress.level).toBe(10); expect(JSON.parse(m.values.get(SAVE_SLOTS.quarantine)!)).toEqual(originals);
  });
  it('部分写入失败不冒充成功，已完成的副本仍可恢复最新状态', async () => {
    const m = memory(), original = m.storage.set; m.storage.set = (key, raw) => { if (key === SAVE_SLOTS.primary) throw Error('quota'); return original(key, raw); };
    const repo = await openSaveRepository(m.storage); await expect(repo.save({ ...repo.progress, level: 7 })).rejects.toThrow('quota');
    expect((await openSaveRepository(m.storage)).progress.level).toBe(7);
  });
});
describe('有界合并写入与超时', () => {
  it('只保留运行中和最新待写快照，不提交中间旧值', async () => {
    const calls: number[] = [], releases: (() => void)[] = [], writer = latestWriter<number>(n => { calls.push(n); return new Promise<void>(resolve => releases.push(resolve)); });
    const first = writer(1), replaced = writer(2).catch(() => 'merged'), latest = writer(3);
    await Promise.resolve(); expect(calls).toEqual([1]); expect(await replaced).toBe('merged');
    releases.shift()!(); await first; await Promise.resolve(); expect(calls).toEqual([1, 3]); releases.shift()!(); await latest;
  });
  it('超时后失败且不并行发起新写，旧请求真正结束后才可安全重试', async () => {
    vi.useFakeTimers();
    try {
      const calls: number[] = []; let release = () => {};
      const writer = latestWriter<number>(n => { calls.push(n); return new Promise<void>(resolve => { release = resolve; }); }, 100);
      const first = writer(1).catch(e => e.message), next = writer(2).catch(e => e.message);
      await vi.advanceTimersByTimeAsync(101); expect(await first).toContain('超时'); expect(await next).toContain('超时');
      await expect(writer(3)).rejects.toThrow('超时'); expect(calls).toEqual([1]);
      release(); await Promise.resolve(); await Promise.resolve();
      const retried = writer(4); await Promise.resolve(); expect(calls).toEqual([1, 4]); release(); await retried;
    } finally { vi.useRealTimers(); }
  });
});
describe('通知与当前委托', () => {
  it('高频裁剪后计时记录有界，到期同步清空', () => {
    const sim = new Simulation(); Object.assign(sim.player, { x: -18, z: 31.2 });
    for (let i = 0; i < 10000; i++) sim.notify('提示', '内容');
    const records = (sim as unknown as { noticeTimes: Map<number, number> }).noticeTimes;
    expect(records.size).toBe(3); for (let i = 0; i < 150; i++) sim.tick(.05, { x: 0, z: 0, sprint: false }); expect(records.size).toBe(0);
  });
  it('收缴完成后的当前委托仍是旧轮，开始下一轮后才切换', () => {
    const sim = new Simulation(); sim.questPhase = 'harvest'; sim.monster.health = 0; Object.assign(sim.player, sim.monster); sim.interact();
    expect(sim.snapshot()).toMatchObject({ hunt: 0, monsterName: '野猫', progress: { hunts: 1 } }); sim.newHunt(); expect(sim.snapshot()).toMatchObject({ hunt: 1, monsterName: '不栓绳的野狗' });
  });
});
