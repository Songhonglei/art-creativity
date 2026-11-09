import type { CityFeatureKind, GameEvent, Soundscape, Weather } from './types';
import { SOUNDSCAPES } from './soundscapes';

/** Fully synthesized, autoplay-safe soundscape. Noise is generated once and reused. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wind: GainNode | null = null;
  private music: GainNode | null = null;
  private calm: GainNode | null = null;
  private tension: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private ambient: AudioBufferSourceNode | null = null;
  private voices: OscillatorNode[] = [];
  private noiseBuffer: AudioBuffer | null = null;
  private noiseOffset = 0;
  private moodKey = '';
  private active = new Set<OscillatorNode | AudioBufferSourceNode>();
  private cityGain: GainNode | null = null;
  private cityFilter: BiquadFilterNode | null = null;
  private cityNoise: AudioBufferSourceNode | null = null;
  private cityHum: OscillatorNode | null = null;
  private cityKind: CityFeatureKind | null = null;
  private cityClock = 0;
  private cityPulse = 0;
  private soundscape: Soundscape = 'neon';
  private mood = { weather: '晴夜' as Weather, combat: false, lowHealth: false, district: '梧桐夜巷' };
  private score = new Map<OscillatorNode, GainNode>();
  private nextNote = 0;
  private scoreStep = 0;
  private root = 110;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  enabled = true; volume = .45;

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
        this.wind = this.ctx.createGain(); this.wind.gain.value = .065; this.wind.connect(this.master);
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 4, this.ctx.sampleRate), data = buffer.getChannelData(0); let last = 0;
        for (let i = 0; i < data.length; i++) { last = (last + (Math.random() * 2 - 1) * .045) / 1.025; data[i] = last * 3; }
        this.ambient = this.ctx.createBufferSource(); this.ambient.buffer = buffer; this.ambient.loop = true;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 460;
        this.ambient.connect(filter); filter.connect(this.wind); this.ambient.start();
        this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const noise = this.noiseBuffer.getChannelData(0); for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
        this.cityGain = this.ctx.createGain(); this.cityGain.gain.value = 0; this.cityGain.connect(this.master);
        this.cityFilter = this.ctx.createBiquadFilter(); this.cityFilter.type = 'bandpass'; this.cityFilter.frequency.value = 700; this.cityFilter.Q.value = .7; this.cityFilter.connect(this.cityGain);
        this.cityNoise = this.ctx.createBufferSource(); this.cityNoise.buffer = this.noiseBuffer; this.cityNoise.loop = true; this.cityNoise.connect(this.cityFilter); this.cityNoise.start();
        this.cityHum = this.ctx.createOscillator(); this.cityHum.type = 'sine'; this.cityHum.frequency.value = 62; const humGain = this.ctx.createGain(); humGain.gain.value = .32; this.cityHum.connect(humGain); humGain.connect(this.cityGain); this.cityHum.start();
        this.music = this.ctx.createGain(); this.music.gain.value = .8; this.music.connect(this.master);
        this.musicFilter = this.ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 1200; this.musicFilter.connect(this.music);
        this.calm = this.ctx.createGain(); this.calm.gain.value = .025; this.calm.connect(this.musicFilter);
        this.tension = this.ctx.createGain(); this.tension.gain.value = 0; this.tension.connect(this.musicFilter);
        [110, 164.81].forEach((frequency, i) => {
          const voice = this.ctx!.createOscillator(); voice.type = i ? 'sine' : 'triangle'; voice.frequency.value = frequency;
          voice.connect(this.calm!); voice.start(); this.voices.push(voice);
        });
        [55, 82.41].forEach(frequency => {
          const voice = this.ctx!.createOscillator(); voice.type = 'sawtooth'; voice.frequency.value = frequency;
          voice.connect(this.tension!); voice.start(); this.voices.push(voice);
        });
        this.moodKey = ''; this.setVolume(this.volume, this.enabled); this.applyMood();
      } catch { return; }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => { });
    if (this.musicTimer === null) this.musicTimer = setInterval(() => this.updateMusic(), 100);
    this.updateMusic();
  }

  setVolume(volume: number, enabled: boolean) {
    this.volume = volume; this.enabled = enabled;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(enabled ? volume : 0, this.ctx.currentTime, .08);
    if (!enabled || volume === 0) this.stopScore();
  }

  setSoundscape(soundscape: Soundscape) {
    if (soundscape === this.soundscape) return;
    this.soundscape = soundscape; this.moodKey = '';
    this.stopScore(); this.applyMood(); this.updateMusic();
  }

  setWeather(weather: Weather) {
    if (this.wind && this.ctx) this.wind.gain.setTargetAtTime(weather === '暴雨' ? .25 : weather === '雾霾' ? .13 : .06, this.ctx.currentTime, 2);
    this.mood.weather = weather; this.applyMood();
  }

  setMood(weather: Weather, combat: boolean, lowHealth: boolean, district: string) {
    this.mood = { weather, combat, lowHealth, district }; this.applyMood();
  }

  private applyMood() {
    if (!this.ctx || !this.calm || !this.tension || !this.musicFilter || !this.voices.length) return;
    const { weather, combat, lowHealth, district } = this.mood;
    const key = `${this.soundscape}:${weather}:${combat}:${lowHealth}:${district}`; if (key === this.moodKey) return; this.moodKey = key;
    const now = this.ctx.currentTime, roots = [98, 110, 123.47, 130.81];
    let hash = 0; for (let i = 0; i < district.length; i++) hash = (hash * 31 + district.charCodeAt(i)) >>> 0;
    const profile = SOUNDSCAPES[this.soundscape], root = roots[hash % roots.length] * profile.scale;
    this.root = root;
    this.voices[0].type = profile.wave; this.voices[1].type = this.soundscape === 'jazz' ? 'triangle' : 'sine';
    this.voices[2].type = this.voices[3].type = profile.tensionWave;
    this.voices[0].frequency.setTargetAtTime(root, now, .12);
    this.voices[1].frequency.setTargetAtTime(root * profile.interval, now, .12);
    this.voices[2].frequency.setTargetAtTime(root / 2, now, .6);
    this.voices[3].frequency.setTargetAtTime(root * .75, now, .6);
    this.calm.gain.setTargetAtTime((combat ? .004 : weather === '晴夜' ? .012 : weather === '雾霾' ? .009 : .006) * profile.gain, now, .2);
    this.tension.gain.setTargetAtTime(combat ? this.soundscape === 'radio' ? .024 : .035 : lowHealth ? .014 : 0, now, .45);
    this.musicFilter.frequency.setTargetAtTime(profile.filter * (weather === '暴雨' ? .65 : weather === '雾霾' ? .8 : 1), now, .12);
    if (this.wind) this.wind.gain.setTargetAtTime(weather === '暴雨' ? .25 : weather === '雾霾' ? .13 : .06, now, 2);
  }

  /** Schedule against the audio clock, including while a settings dialog pauses the game. */
  updateMusic() {
    if (!this.ctx || this.ctx.state !== 'running' || !this.enabled || this.volume <= 0) return;
    const now = this.ctx.currentTime;
    if (this.nextNote < now) this.nextNote = now + .02;
    const profile = SOUNDSCAPES[this.soundscape];
    while (this.nextNote < now + .3) {
      this.scheduleStep(this.scoreStep, this.nextNote);
      const swing = this.soundscape === 'jazz' ? this.scoreStep % 2 === 0 ? 4 / 3 : 2 / 3 : 1;
      this.nextNote += profile.step * swing; this.scoreStep++;
    }
  }

  private scheduleStep(step: number, start: number) {
    const profile = SOUNDSCAPES[this.soundscape], index = step % profile.melody.length;
    const chord = profile.chords[Math.floor(step / 4) % profile.chords.length];
    const level = this.mood.combat ? .65 : 1;
    if (this.soundscape === 'river') {
      this.musicNote(profile.melody[index], start, 3.2, 'sine', .045 * level, .5);
      if (step % 4 === 0) chord.forEach(note => this.musicNote(note + 12, start, 5.5, 'sine', .018 * level, 1));
    } else if (this.soundscape === 'jazz') {
      this.musicNote(chord[step % chord.length], start, .32, 'triangle', .065 * level);
      if (step % 2 === 0) this.musicNote(profile.melody[index], start, .42, 'sine', .055 * level);
      if (step % 4 === 1) chord.forEach(note => this.musicNote(note + 12, start, .45, 'triangle', .018 * level));
    } else if (this.soundscape === 'radio') {
      this.musicNote(profile.melody[index], start, .25, 'triangle', .055 * level);
      if (step % 2 === 0) this.musicNote(chord[step % 4 === 0 ? 0 : 2], start, .24, 'sine', .065 * level);
      else chord.forEach(note => this.musicNote(note + 12, start, .16, 'triangle', .018 * level));
    } else {
      this.musicNote(profile.melody[index], start, .18, 'triangle', .055 * level);
      if (step % 4 === 0) this.musicNote(chord[0] - 12, start, .22, 'sine', .09 * level);
    }
  }

  private musicNote(semitone: number, start: number, duration: number, wave: OscillatorType, volume: number, attack = .012) {
    if (!this.ctx || !this.musicFilter) return;
    const voice = this.ctx.createOscillator(), gain = this.ctx.createGain();
    voice.type = wave; voice.frequency.setValueAtTime(this.root * 2 ** (semitone / 12), start);
    gain.gain.setValueAtTime(.0001, start); gain.gain.linearRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    voice.connect(gain); gain.connect(this.musicFilter); this.score.set(voice, gain);
    voice.onended = () => { voice.disconnect(); gain.disconnect(); this.score.delete(voice); };
    voice.start(start); voice.stop(start + duration + .02);
  }

  private stopScore() {
    if (this.ctx) {
      const now = this.ctx.currentTime;
      for (const [voice, gain] of this.score) {
        gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(.0001, now, .008);
        voice.stop(now + .04);
      }
    }
    this.nextNote = 0; this.scoreStep = 0;
  }

  /** Distance-driven local city details; all sources are persistent and reused while walking. */
  setCityFeature(kind: CityFeatureKind | null, distance: number) {
    this.cityKind = kind;
    if (!this.ctx || !this.cityGain || !this.cityFilter || !this.cityHum) return;
    const range = kind === 'park' ? 21 : kind === 'river' ? 18 : kind === 'taxi' ? 15 : kind === 'store' ? 13 : 10;
    const proximity = kind ? Math.max(0, 1 - distance / range) : 0;
    const level = kind === 'river' ? .22 : kind === 'park' ? .1 : kind === 'taxi' ? .13 : kind === 'store' ? .085 : .07;
    const frequency = kind === 'river' ? 1150 : kind === 'park' ? 3200 : kind === 'taxi' ? 210 : kind === 'store' ? 460 : 780;
    this.cityGain.gain.setTargetAtTime(proximity * proximity * level, this.ctx.currentTime, .18);
    this.cityFilter.frequency.setTargetAtTime(frequency, this.ctx.currentTime, .25);
    this.cityHum.frequency.setTargetAtTime(kind === 'taxi' ? 48 : kind === 'store' ? 62 : kind === 'youth' ? 105 : kind === 'park' ? 1850 : 90, this.ctx.currentTime, .2);
  }

  updateCity(dt: number) {
    if (!this.ctx || !this.enabled || !this.cityKind || !this.cityGain || this.cityGain.gain.value < .004) return;
    this.cityClock += dt;
    const interval = this.cityKind === 'store' ? 5.5 : this.cityKind === 'taxi' ? 8 : this.cityKind === 'youth' ? 4.2 : 3.4;
    if (this.cityClock < interval) return;
    this.cityClock = 0; this.cityPulse++;
    if (this.cityKind === 'store') { this.tone(880, .22, 'sine', .055); this.tone(1174, .42, 'sine', .045, 1174, .18); }
    else if (this.cityKind === 'taxi' && this.cityPulse % 2 === 0) { this.tone(310, .32, 'square', .035, 280); this.tone(390, .28, 'square', .025, 350, .08); }
    else if (this.cityKind === 'youth') { this.tone(105 + this.cityPulse % 3 * 18, .7, 'sawtooth', .018, 72); this.noise(.12, 1800, .025); }
    else if (this.cityKind === 'park') { this.tone(2600 + this.cityPulse % 3 * 300, .12, 'sine', .018, 3400); this.tone(3100, .1, 'sine', .012, 2500, .17); }
  }

  get audioDebug() { return { soundscape: this.soundscape, scoreStep: this.scoreStep, scoreVoices: this.score.size, root: this.root, cityKind: this.cityKind, cityLevel: this.cityGain?.gain.value ?? 0, context: this.ctx?.state ?? 'locked' }; }

  private tone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = .1, end = frequency, delay = 0) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx, start = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(frequency, start); o.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(volume, start + .012); g.gain.exponentialRampToValueAtTime(.001, start + duration);
    o.connect(g); g.connect(this.master); o.start(start); o.stop(start + duration + .02); this.active.add(o);
    o.onended = () => { o.disconnect(); g.disconnect(); this.active.delete(o); };
  }

  private noise(duration: number, frequency: number, volume: number) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(), now = ctx.currentTime;
    source.buffer = this.noiseBuffer; filter.type = 'lowpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master);
    const maxOffset = Math.max(0, this.noiseBuffer.duration - duration); this.noiseOffset = (this.noiseOffset + .371) % Math.max(.01, maxOffset);
    source.start(now, this.noiseOffset, duration); this.active.add(source);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); this.active.delete(source); };
  }

  play(e: GameEvent) {
    if (!this.enabled || !this.ctx) return;
    switch (e.type) {
      case 'attack': this.noise(.25, 1800, .22); this.tone(160, .2, 'triangle', .07, 65); break;
      case 'hit': this.noise(.19, 1000, .45); this.tone(85, .2, 'triangle', .36, 28); this.tone(780, .12, 'sine', .12, 180); break;
      case 'hurt': this.noise(.3, 480, .3); this.tone(130, .25, 'sawtooth', .12, 35); break;
      case 'dodge': this.noise(.24, 850, .22); break;
      case 'roar':
        if (e.kind === 'ebike' || e.kind === 'racer') { this.noise(.7, 820, .24); this.tone(180, .75, 'sawtooth', .09, 62); }
        else if (e.kind === 'cat') { this.tone(510, .5, 'triangle', .08, 230); this.noise(.25, 1500, .1); }
        else if (e.kind === 'dog') { this.noise(.45, 720, .24); this.tone(150, .42, 'square', .06, 85); }
        else { this.noise(.9, e.kind === 'official' ? 230 : 340, .28); this.tone(e.kind === 'official' ? 58 : 75, .8, 'sawtooth', .055, 42); }
        break;
      case 'pet': [440, 660, 880].forEach((f, i) => this.tone(f, .42, 'sine', .065, f * 1.08, i * .06)); break;
      case 'gather': case 'heal': [520, 650, 780].forEach((f, i) => this.tone(f, .5, 'sine', .07, f, i * .09)); break;
      case 'forge': this.noise(.2, 2200, .28); [390, 780, 1170].forEach(f => this.tone(f, 1, 'sine', .07)); break;
      case 'victory': [196, 247, 294, 392, 494].forEach((f, i) => this.tone(f, 1.7, 'triangle', .07, f, i * .18)); break;
      case 'step': this.noise(.085, 320, .075); break;
      case 'weather': break;
    }
  }

  dispose() {
    if (this.musicTimer !== null) clearInterval(this.musicTimer); this.musicTimer = null;
    this.stopScore(); this.score.forEach((gain, voice) => { voice.disconnect(); gain.disconnect(); }); this.score.clear();
    this.active.forEach(n => { try { n.stop(); } catch { /* Already ended. */ } }); this.active.clear();
    this.voices.forEach(v => { try { v.stop(); } catch { /* Already stopped. */ } }); this.voices = [];
    try { this.ambient?.stop(); } catch { /* Already stopped. */ }
    try { this.cityNoise?.stop(); } catch { /* Already stopped. */ }
    try { this.cityHum?.stop(); } catch { /* Already stopped. */ }
    if (this.ctx) void this.ctx.close().catch(() => { }); this.ctx = null;
  }
}
