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
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new Node();
  oscillators: Source[] = [];
  gains: (Node & { gain: Param })[] = [];
  constructor() { Context.latest = this; }
  createGain() { const gain = Object.assign(new Node(), { gain: new Param() }); this.gains.push(gain); return gain; }
  createBiquadFilter() { return Object.assign(new Node(), { type: 'lowpass', frequency: new Param(), Q: new Param() }); }
  createBuffer(_channels: number, length: number, rate: number) { return { duration: length / rate, getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { return Object.assign(new Source(), { loop: false, buffer: null }); }
  createOscillator() { const source = new Source(); this.oscillators.push(source); return source; }
  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
}

const modes: Soundscape[] = ['neon', 'jazz', 'river', 'radio'];

describe('城市声景', () => {
  let audio: GameAudio;
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('AudioContext', Context); audio = new GameAudio(); });
  afterEach(() => { audio.dispose(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('选择在首次解锁前保留，首次发声直接使用所选声景', () => {
    audio.setSoundscape('jazz'); audio.unlock();
    expect(audio.audioDebug.soundscape).toBe('jazz');
    expect(Context.latest.oscillators[1].type).toBe('sine');
    expect(Context.latest.oscillators[3].type).toBe('triangle');
    expect(audio.audioDebug.scoreVoices).toBeGreaterThan(0);
  });

  it('不依赖游戏帧或 mood 轮询，切换立即替换发声和旧旋律', () => {
    audio.unlock();
    const oldScore = Context.latest.oscillators.slice(5);
    const oldRoot = audio.audioDebug.root;
    audio.setSoundscape('river');
    expect(audio.audioDebug.root).not.toBe(oldRoot);
    expect(Context.latest.oscillators[1].type).toBe('sine');
    expect(oldScore.every(source => source.stop.mock.calls.length === 2)).toBe(true);
    const newScore = Context.latest.oscillators.slice(5 + oldScore.length);
    expect(newScore.length).toBeGreaterThan(0);
    expect(newScore[0].stop.mock.calls[0][0]).toBeGreaterThan(3);
  });

  it('四套声景的实际音符、波形和节奏均可区分', () => {
    const signatures = modes.map(mode => {
      const player = new GameAudio(); player.setSoundscape(mode); player.unlock();
      const ctx = Context.latest;
      for (let i = 1; i <= 25; i++) { ctx.currentTime = i * .2; player.updateMusic(); }
      const signature = ctx.oscillators.slice(5).map(source => ({
        wave: source.type, frequency: source.frequency.setValueAtTime.mock.calls[0][0],
        start: source.start.mock.calls[0], end: source.stop.mock.calls[0],
      }));
      player.dispose(); return JSON.stringify(signature);
    });
    expect(new Set(signatures).size).toBe(4);
  });

  it('音量或其他设置重复提交同一声景时不会重启旋律', () => {
    audio.unlock(); const ctx = Context.latest, sources = ctx.oscillators.length;
    const stops = ctx.oscillators.slice(5).map(source => source.stop.mock.calls.length);
    audio.setVolume(.6, true); audio.setSoundscape('neon');
    expect(ctx.oscillators).toHaveLength(sources);
    expect(ctx.oscillators.slice(5).map(source => source.stop.mock.calls.length)).toEqual(stops);
  });

  it('静音时保存所选声景，恢复声音后才生成旋律', () => {
    audio.setVolume(.45, false); audio.setSoundscape('radio'); audio.unlock();
    expect(audio.audioDebug.soundscape).toBe('radio');
    expect(audio.audioDebug.scoreVoices).toBe(0);
    audio.setVolume(.45, true); audio.updateMusic();
    expect(audio.audioDebug.scoreVoices).toBeGreaterThan(0);
  });

  it('主音量归零后停止旧旋律且不继续调度', () => {
    audio.unlock(); const ctx = Context.latest, sources = ctx.oscillators.length;
    audio.setVolume(0, true); ctx.currentTime = 20; audio.updateMusic();
    expect(ctx.oscillators).toHaveLength(sources);
    expect(ctx.oscillators.slice(5).every(source => source.stop.mock.calls.length === 2)).toBe(true);
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
    expect(ctx.oscillators[3].type).toBe('triangle');
    expect(ctx.gains[6].gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(.035);
    expect(hitSources.every(source => source.stop.mock.calls.length === 1)).toBe(true);
  });

  it('释放结束的音乐节点，销毁后不再生成声音', () => {
    audio.unlock(); const ctx = Context.latest, score = ctx.oscillators.slice(5);
    score.forEach(source => source.onended?.());
    expect(audio.audioDebug.scoreVoices).toBe(0);
    expect(score.every(source => source.disconnect.mock.calls.length === 1)).toBe(true);
    audio.dispose(); const count = ctx.oscillators.length; audio.updateMusic();
    expect(ctx.close).toHaveBeenCalled(); expect(ctx.oscillators).toHaveLength(count);
    expect(audio.audioDebug.context).toBe('locked');
  });
});
