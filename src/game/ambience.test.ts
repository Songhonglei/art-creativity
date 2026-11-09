import { describe, expect, it } from 'vitest';
import { AmbienceScheduler } from './ambience';

function run(s: AmbienceScheduler, seconds: number) {
  const cues = [];
  for (let i = 0; i < seconds * 4; i++) { const cue = s.update(.25); if (cue) cues.push({ ...cue, time: i / 4 }); }
  return cues;
}
describe('稀疏环境声', () => {
  it('晴夜且远离声源时长期只保留音乐，不调度风雨或城市噪声', () => {
    const s = new AmbienceScheduler(() => .5); s.setCity('taxi', 30); s.setAnimal('dog', 20);
    expect(run(s, 120)).toEqual([]);
  });
  it('车辆、店铺和江边必须靠近才触发，桥上可听到江边声', () => {
    for (const [kind, distance] of [['taxi', 10], ['store', 7.5], ['river', 16], ['bridge', 16]] as const) {
      const s = new AmbienceScheduler(() => .5); s.setCity(kind, distance); expect(run(s, 60)).toEqual([]);
      s.setCity(kind, 1); expect(run(s, 30).length).toBeGreaterThan(0);
    }
  });
  it('越远越轻，战斗时环境声再压低', () => {
    const s = new AmbienceScheduler(() => .5); s.setCity('taxi', 0); const near = run(s, 15)[0];
    s.reset(); s.setCity('taxi', 5); const far = run(s, 15)[0]; expect(far.level).toBeCloseTo(near.level * .25);
    s.reset(); s.combat = true; const fight = run(s, 15)[0]; expect(fight.level).toBeCloseTo(far.level * .35);
  });
  it('暴雨才有雨声，雾霾只偶发阵风，天气转晴不再发声', () => {
    const s = new AmbienceScheduler(() => .5); s.weather = '暴雨';
    expect(run(s, 35).every(c => c.kind === 'rain')).toBe(true); expect(run(s, 35).length).toBeGreaterThan(0);
    s.weather = '雾霾'; const wind = run(s, 40); expect(wind.length).toBeGreaterThan(0); expect(wind.every(c => c.kind === 'wind')).toBe(true);
    s.weather = '晴夜'; expect(run(s, 60)).toEqual([]);
  });
  it('猫狗只在附近偶发叫声，进入战斗后不叠加闲逛叫声', () => {
    const s = new AmbienceScheduler(() => .5); s.setAnimal('dog', 2); expect(run(s, 30).some(c => c.animal === 'dog')).toBe(true);
    s.combat = true; expect(run(s, 40)).toEqual([]);
    s.combat = false; s.setAnimal('dog', 16); expect(run(s, 40)).toEqual([]);
  });
  it('天气、城市与动物共享安静间隔，不扎堆叠加', () => {
    const s = new AmbienceScheduler(() => .5); s.weather = '暴雨'; s.setCity('river', 1); s.setAnimal('dog', 1);
    const cues = run(s, 120); expect(new Set(cues.map(c => c.kind)).size).toBe(3);
    for (let i = 1; i < cues.length; i++) expect(cues[i].time - cues[i - 1].time).toBeGreaterThanOrEqual(5.5);
  });
  it('随机值影响触发间隔，停留时不会按固定节拍重复', () => {
    let n = 0; const s = new AmbienceScheduler(() => [0, .2, .8, .4, .6, 1][n++ % 6]); s.setCity('taxi', 0);
    const cues = run(s, 180), gaps = cues.slice(1).map((c, i) => c.time - cues[i].time);
    expect(new Set(gaps).size).toBeGreaterThan(1);
  });
  it('暂停不推进倒计时，超长帧不补播积压环境声', () => {
    const s = new AmbienceScheduler(() => .5); s.weather = '暴雨';
    for (let i = 0; i < 100; i++) expect(s.update(0)).toBeNull();
    expect(s.update(1000)).toBeNull(); expect(run(s, 2)).toEqual([]);
  });
});
