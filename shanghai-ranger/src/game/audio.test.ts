import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from './audio';
import type { Soundscape } from './types';

class Param {
  value = 0;
  setValueAtTime = vi.fn((value: number) => { this.value = value; });
  setTargetAtTime = vi.fn((value: number) => { this.value = value; });
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}

class Node {
  connect = vi.fn();
  disconnect = vi.fn();
}

class Source extends Node {
  type: OscillatorType = 'sine';
  frequency = new Param();
  start = vi.fn((_when?: number) => {});
  stop = vi.fn((_when?: number) => {});
  onended: (() => void) | null = null;
}

class Context {
  static latest: Context;
  static instances: Context[] = [];
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new Node();
  oscillators: Source[] = [];
  buffers: (Source & { loop: boolean })[] = [];
  gains: (Node & { gain: Param })[] = [];
  constructor() { Context.latest = this; Context.instances.push(this); }
  createGain() { const gain = Object.assign(new Node(), { gain: new Param() }); gain.gain.value = 1; this.gains.push(gain); return gain; }
  createBiquadFilter() { return Object.assign(new Node(), { type: 'lowpass', frequency: new Param(), Q: new Param() }); }
  createBuffer(_channels: number, length: number, rate: number) { return { duration: length / rate, getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { const source = Object.assign(new Source(), { loop: false, buffer: null }); this.buffers.push(source); return source; }
  createOscillator() { const source = new Source(); this.oscillators.push(source); return source; }
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => { this.state = 'closed'; });
}

const modes: Soundscape[] = ['neon', 'jazz', 'river', 'radio'];

describe('城市声景', () => {
  let audio: GameAudio;
  beforeEach(() => { Context.instances = []; vi.useFakeTimers(); vi.stubGlobal('AudioContext', Context); audio = new GameAudio(); });
  afterEach(() => { audio.dispose(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('选择在首次解锁前保留，首次发声直接使用所选声景', () => {
    audio.setSoundscape('jazz'); audio.unlock();
    expect(audio.audioDebug.soundscape).toBe('jazz');
    expect(Context.latest.oscillators[0].type).toBe('triangle');
    expect(Context.latest.oscillators[1].type).toBe('sine');
    expect(audio.audioDebug.scoreVoices).toBeGreaterThan(0);
  });
  it('切后台停止调度并暂停音频上下文，返回后可恢复', () => {
    audio.unlock(); const context = Context.latest;
    audio.setBackground(true); expect(context.suspend).toHaveBeenCalled();
    const count = context.oscillators.length; context.currentTime = 5; audio.updateMusic(); expect(context.oscillators.length).toBe(count);
    audio.setBackground(false); expect(context.resume).toHaveBeenCalled();
  });

  it('不依赖游戏帧或 mood 轮询，切换立即替换发声和旧旋律', () => {
    audio.unlock();
    const oldScore = Context.latest.oscillators.slice(0);
    const oldRoot = audio.audioDebug.root;
    audio.setSoundscape('river');
    expect(audio.audioDebug.root).not.toBe(oldRoot);
    expect(oldScore.every(source => source.stop.mock.calls.length === 2)).toBe(true);
    const newScore = Context.latest.oscillators.slice(oldScore.length);
    expect(newScore.length).toBeGreaterThan(0);
    expect(newScore[0].stop.mock.calls[0][0]).toBeGreaterThan(1);
  });

  it('四套声景的实际音符、波形和节奏均可区分', () => {
    const signatures = modes.map(mode => {
      const player = new GameAudio(); player.setSoundscape(mode); player.unlock();
      const ctx = Context.latest;
      for (let i = 1; i <= 25; i++) { ctx.currentTime = i * .2; player.updateMusic(); }
      const signature = ctx.oscillators.slice(0).map(source => ({
        wave: source.type, frequency: source.frequency.setValueAtTime.mock.calls[0][0],
        start: source.start.mock.calls[0], end: source.stop.mock.calls[0],
      }));
      player.dispose(); return JSON.stringify(signature);
    });
    expect(new Set(signatures).size).toBe(4);
  });

  it('音量或其他设置重复提交同一声景时不会重启旋律', () => {
    audio.unlock(); const ctx = Context.latest, sources = ctx.oscillators.length;
    const stops = ctx.oscillators.slice(0).map(source => source.stop.mock.calls.length);
    audio.setVolume(.6, true); audio.setSoundscape('neon');
    expect(ctx.oscillators).toHaveLength(sources);
    expect(ctx.oscillators.slice(0).map(source => source.stop.mock.calls.length)).toEqual(stops);
  });

  it('静音时保存所选声景，恢复声音后才生成旋律', () => {
    audio.setVolume(.45, false); audio.setSoundscape('radio'); audio.unlock();
    expect(audio.audioDebug.soundscape).toBe('radio');
    expect(audio.audioDebug.scoreVoices).toBe(0);
    audio.setVolume(.45, true); audio.unlock(); audio.updateMusic();
    expect(audio.audioDebug.scoreVoices).toBeGreaterThan(0);
  });

  it('主音量归零后停止旧旋律且不继续调度', () => {
    audio.unlock(); const ctx = Context.latest, sources = ctx.oscillators.length;
    audio.setVolume(0, true); ctx.currentTime = 20; audio.updateMusic();
    expect(ctx.oscillators).toHaveLength(sources);
    expect(ctx.oscillators.slice(0).every(source => source.stop.mock.calls.length === 2)).toBe(true);
    audio.setVolume(.45, true); audio.updateMusic();
    expect(ctx.oscillators.length).toBeGreaterThan(sources);
  });

  it('后台恢复后跳过过期音符，不集中播放积压音符', () => {
    audio.unlock(); const ctx = Context.latest, before = ctx.oscillators.length;
    ctx.currentTime = 120; audio.updateMusic();
    const resumed = ctx.oscillators.slice(before);
    expect(resumed.length).toBeGreaterThan(0); expect(resumed.length).toBeLessThan(10);
    expect(resumed.every(source => (source.start.mock.calls[0][0] ?? 0) >= 120)).toBe(true);
  });

  it('游戏不更新时独立调度旋律，销毁时清理调度器', () => {
    audio.unlock(); const ctx = Context.latest, before = audio.audioDebug.scoreStep;
    ctx.currentTime = 1; vi.advanceTimersByTime(100);
    expect(audio.audioDebug.scoreStep).toBeGreaterThan(before);
    expect(vi.getTimerCount()).toBe(1);
    audio.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it('切换声景时保留天气、战斗状态及独立战斗音效', () => {
    audio.unlock(); audio.setMood('暴雨', true, true, '老弄堂'); audio.play({ type: 'hit' });
    const ctx = Context.latest, hitSources = ctx.oscillators.slice(-2);
    audio.setSoundscape('jazz');
    expect(audio.audioDebug.soundscape).toBe('jazz');
    expect(audio.audioDebug.ambientVoices).toBe(0);
    expect(ctx.oscillators.every(source => source.stop.mock.calls.length > 0)).toBe(true);
    expect(hitSources.every(source => source.stop.mock.calls.length === 1)).toBe(true);
  });

  it('释放结束的音乐节点，销毁后不再生成声音', () => {
    audio.unlock(); const ctx = Context.latest, score = ctx.oscillators.slice(0);
    score.forEach(source => source.onended?.());
    expect(audio.audioDebug.scoreVoices).toBe(0);
    expect(score.every(source => source.disconnect.mock.calls.length === 1)).toBe(true);
    audio.dispose(); const count = ctx.oscillators.length; audio.updateMusic();
    expect(ctx.close).toHaveBeenCalled(); expect(ctx.oscillators).toHaveLength(count);
    expect(audio.audioDebug.context).toBe('locked');
  });

  it('静音启动和零音量启动均不创建音频上下文，游戏操作不能唤醒底噪', () => {
    audio.setVolume(.45, false);
    for (let i = 0; i < 5; i++) { audio.unlock(); audio.play({ type: 'hit', heavy: true }); }
    expect(Context.instances).toHaveLength(0);
    audio.setVolume(0, true); audio.unlock(); expect(Context.instances).toHaveLength(0);
    audio.setVolume(.45, true); audio.unlock(); expect(Context.instances).toHaveLength(1);
  });

  it('死亡与复活音一次性发声，静音和音量0不增加任何音源', () => {
    audio.setVolume(.45, false); audio.play({ type: 'fall' }); audio.play({ type: 'revive' });
    expect(Context.instances).toHaveLength(0);
    audio.setVolume(.45, true); audio.unlock(); const ctx = Context.latest;
    const before = ctx.oscillators.length;
    audio.play({ type: 'fall' }); expect(ctx.oscillators.length).toBe(before + 1);
    audio.play({ type: 'revive' }); expect(ctx.oscillators.length).toBe(before + 4);
    audio.setVolume(.45, false); const muted = ctx.oscillators.length;
    audio.play({ type: 'fall' }); audio.play({ type: 'revive' }); expect(ctx.oscillators).toHaveLength(muted);
    audio.setVolume(0, true); audio.play({ type: 'fall' }); audio.play({ type: 'revive' });
    expect(ctx.oscillators).toHaveLength(muted);
  });

  it('关闭声音会立即归零并断开输出，而非只让低频缓慢淡出', () => {
    audio.unlock(); audio.setCityFeature('taxi', 0); audio.setMood('暴雨', true, true, '老城');
    const ctx = Context.latest, master = ctx.gains[0];
    audio.setVolume(.45, false);
    expect(master.gain.setValueAtTime).toHaveBeenLastCalledWith(0, ctx.currentTime);
    expect(master.gain.value).toBe(0); expect(master.disconnect).toHaveBeenCalledWith(ctx.destination);
    expect(audio.audioDebug.outputConnected).toBe(false); expect(vi.getTimerCount()).toBe(0);
    const before = ctx.oscillators.length;
    audio.unlock(); audio.setCityFeature('store', 0); audio.setWeather('暴雨'); audio.setSoundscape('river'); audio.updateCity(100); audio.play({ type: 'roar' });
    expect(ctx.oscillators).toHaveLength(before); expect(audio.audioDebug.outputConnected).toBe(false);
  });

  it('音量归零停止延后音效，恢复声音只重新连接一次且不重建持续声源', () => {
    audio.unlock(); audio.play({ type: 'victory' }); const ctx = Context.latest;
    const effects = ctx.oscillators.slice(-5), master = ctx.gains[0];
    audio.setVolume(0, true);
    expect(master.gain.value).toBe(0); expect(audio.audioDebug.outputConnected).toBe(false);
    expect(effects.every(source => source.stop.mock.calls.length === 2)).toBe(true);
    audio.setVolume(.5, true); audio.unlock(); audio.setVolume(.5, true); audio.unlock();
    expect(Context.instances).toHaveLength(1); expect(master.connect).toHaveBeenCalledTimes(2);
    expect(audio.audioDebug.outputConnected).toBe(true); expect(vi.getTimerCount()).toBe(1);
  });

  it('快速反复开关保持最后一次静音，不积累输出连接或调度器', () => {
    audio.unlock(); const master = Context.latest.gains[0];
    for (let i = 0; i < 10; i++) { audio.setVolume(.4, false); audio.unlock(); audio.setVolume(.4, true); audio.unlock(); }
    audio.setVolume(.4, false);
    expect(master.gain.value).toBe(0); expect(audio.audioDebug.outputConnected).toBe(false);
    expect(Context.instances).toHaveLength(1); expect(vi.getTimerCount()).toBe(0);
    audio.dispose(); audio.unlock(); expect(Context.instances).toHaveLength(1);
  });

  it('初始化中途失败会清理已有节点和上下文，不留下孤立的底噪', () => {
    const create = vi.spyOn(Context.prototype, 'createOscillator').mockImplementationOnce(() => { throw new Error('unsupported'); });
    audio.unlock(); expect(Context.latest.close).toHaveBeenCalled(); expect(Context.latest.gains[0].disconnect).toHaveBeenCalled();
    expect(audio.audioDebug.outputConnected).toBe(false); expect(vi.getTimerCount()).toBe(0);
    create.mockRestore();
  });
  it('四套音乐和战斗状态均无常驻噪声、循环音源或无期限振荡器', () => {
    for (const mode of modes) {
      const player = new GameAudio(); player.setSoundscape(mode); player.unlock(); player.setMood('暴雨', true, true, '老城');
      const ctx = Context.latest;
      expect(ctx.buffers).toHaveLength(0);
      expect(ctx.oscillators.every(source => source.stop.mock.calls.length > 0 && Number.isFinite(source.stop.mock.calls[0][0]))).toBe(true);
      player.dispose();
    }
  });

  it('靠近声源才间歇创建短音源，离开或打开菜单会终止环境声', () => {
    audio.unlock(); const ctx = Context.latest; audio.setCityFeature('river', 0);
    expect(ctx.buffers).toHaveLength(0); expect(audio.audioDebug.ambientCount).toBe(0);
    for (let i = 0; i < 80; i++) audio.updateCity(.25);
    expect(audio.audioDebug.ambientCount).toBeGreaterThan(0);
    expect(ctx.buffers.every(source => !source.loop && source.stop.mock.calls.length > 0)).toBe(true);
    audio.setCityFeature(null, Infinity); expect(audio.audioDebug.ambientVoices).toBe(0);
    audio.setCityFeature('taxi', 0); for (let i = 0; i < 100; i++) audio.updateCity(.25);
    audio.setEnvironmentActive(false); const count = audio.audioDebug.ambientCount;
    for (let i = 0; i < 100; i++) audio.updateCity(.25);
    expect(audio.audioDebug.ambientVoices).toBe(0); expect(audio.audioDebug.ambientCount).toBe(count);
  });

  it('远处怪物不叫，近处叫声有冷却，音乐切换不取消必要打击音效', () => {
    audio.unlock(); const ctx = Context.latest, before = ctx.oscillators.length;
    audio.play({ type: 'roar', kind: 'dog' }, 30); expect(ctx.oscillators).toHaveLength(before);
    audio.play({ type: 'roar', kind: 'dog' }, 2); const close = ctx.oscillators.length; expect(close).toBeGreaterThan(before);
    for (let i = 0; i < 10; i++) audio.play({ type: 'roar', kind: 'dog' }, 2);
    expect(ctx.oscillators).toHaveLength(close);
    audio.setEnvironmentActive(false); ctx.currentTime = 20; audio.play({ type: 'roar', kind: 'cat' }, 1);
    expect(ctx.oscillators).toHaveLength(close);
  });

  it('暴雨只发短雨声，转晴会收掉已有雨声且不再调度', () => {
    audio.unlock(); audio.setWeather('暴雨');
    for (let i = 0; i < 40; i++) audio.updateCity(.25);
    expect(audio.audioDebug.lastAmbient?.kind).toBe('rain');
    const count = audio.audioDebug.ambientCount, sources = Context.latest.buffers;
    expect(sources.length).toBeGreaterThan(0); expect(sources.every(source => !source.loop && source.stop.mock.calls[0][0]! <= 1.1)).toBe(true);
    audio.setWeather('晴夜'); expect(audio.audioDebug.ambientVoices).toBe(0);
    expect(sources.every(source => source.stop.mock.calls.length === 2)).toBe(true);
    for (let i = 0; i < 100; i++) audio.updateCity(.25);
    expect(audio.audioDebug.ambientCount).toBe(count);
  });

  it('音频上下文暂停时不积压环境声，恢复后重新等待触发', () => {
    audio.unlock(); audio.setCityFeature('store', 0); const ctx = Context.latest; ctx.state = 'suspended';
    for (let i = 0; i < 1000; i++) audio.updateCity(.25);
    expect(audio.audioDebug.ambientCount).toBe(0);
    ctx.state = 'running'; audio.updateCity(.25); expect(audio.audioDebug.ambientCount).toBe(0);
    for (let i = 0; i < 60; i++) audio.updateCity(.25);
    expect(audio.audioDebug.ambientCount).toBeGreaterThan(0);
  });

});
