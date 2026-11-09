import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS, readProgress, Simulation } from './simulation';

function storageFixture() {
  let blocked = false, writes = 0, stored = JSON.stringify(DEFAULT_PROGRESS);
  const sim = new Simulation(readProgress(stored), undefined, progress => {
    writes++;
    if (blocked) throw new DOMException('Storage unavailable', 'QuotaExceededError');
    stored = JSON.stringify(progress);
  });
  return { sim, block: (value: boolean) => { blocked = value; }, stored: () => readProgress(stored), writes: () => writes };
}

describe('存档失败与恢复', () => {
  it('尚未写入时不宣称保存成功，写入成功后才更新状态', () => {
    const { sim, stored } = storageFixture();
    expect(sim.snapshot().saveStatus).toBe('idle');
    sim.setPet('corgi');
    expect(sim.snapshot().saveStatus).toBe('saved');
    expect(stored().pet).toBe('corgi');
  });

  it('保存失败不会打断奖励结算，保留内存进度和上一次有效存档', () => {
    const { sim, block, stored } = storageFixture();
    block(true);
    sim.questPhase = 'harvest'; sim.monster.health = 0;
    sim.player.x = sim.monster.x; sim.player.z = sim.monster.z;
    expect(sim.interact()).toBe(true);
    expect(sim.snapshot()).toMatchObject({ questPhase: 'complete', saveStatus: 'failed' });
    expect(sim.progress).toMatchObject({ hunts: 1, cash: DEFAULT_PROGRESS.cash + 800, parts: DEFAULT_PROGRESS.parts + 4 });
    expect(stored()).toEqual(DEFAULT_PROGRESS);
    sim.paused = true;
    expect(sim.retrySave()).toBe(false);
    expect(sim.snapshot().saveStatus).toBe('failed');
    expect(stored()).toEqual(DEFAULT_PROGRESS);
  });

  it('重试保存最新成长，重复点击不会重复发奖励或扣材料', () => {
    const { sim, block, stored, writes } = storageFixture();
    block(true);
    sim.progress.cash = 3000; sim.progress.parts = 20;
    expect(sim.levelUp()).toBe(true);
    sim.setSkin('magnolia'); sim.setPet('shiba');
    const latest = { ...sim.progress };
    expect(sim.saveStatus).toBe('failed');
    block(false);
    sim.paused = true;
    expect(sim.retrySave()).toBe(true);
    expect(sim.retrySave()).toBe(true);
    expect(writes()).toBe(5);
    expect(stored()).toEqual(latest);
    expect(sim.progress).toEqual(latest);
    expect(sim.snapshot().saveStatus).toBe('saved');
  });

  it('下一次自动保存成功也会清除失败状态，开始新一轮不会清掉未保存标记', () => {
    const { sim, block, stored } = storageFixture();
    block(true); sim.setSkin('neon'); sim.newHunt();
    expect(sim.snapshot().saveStatus).toBe('failed');
    block(false); sim.setPet('corgi');
    expect(sim.snapshot().saveStatus).toBe('saved');
    expect(stored()).toMatchObject({ skin: 'neon', pet: 'corgi' });
  });
});
