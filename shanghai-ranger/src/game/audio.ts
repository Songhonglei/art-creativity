import type { CityFeatureKind, GameEvent, Soundscape, Weather } from './types';
import { SOUNDSCAPES } from './soundscapes';
import { AmbienceScheduler } from './ambience';
import type { AmbientCue, AmbientKind } from './ambience';

/** Fully synthesized, autoplay-safe soundscape. Noise is generated once and reused. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private noiseOffset = 0;
  private moodKey = '';
  private active = new Set<OscillatorNode | AudioBufferSourceNode>();
  private ambience = new AmbienceScheduler();
  private ambientVoices = new Map<OscillatorNode | AudioBufferSourceNode, { gain: GainNode; kind: AmbientKind }>();
  private environmentActive = true;
  private lastAmbient: AmbientCue | null = null;
  private ambientCount = 0;
  private nextRoar = 0;
  private soundscape: Soundscape = 'neon';
  private mood = { weather: '晴夜' as Weather, combat: false, lowHealth: false, district: '梧桐夜巷' };
  private score = new Map<OscillatorNode, GainNode>();
  private nextNote = 0;
  private scoreStep = 0;
  private root = 110;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private outputConnected = false;
  private disposed = false;
  enabled = true; volume = .45;

  unlock() {
    if (this.disposed || !this.enabled || this.volume <= 0) return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value = 0;
        this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const noise = this.noiseBuffer.getChannelData(0); for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
        this.music = this.ctx.createGain(); this.music.gain.value = .8; this.music.connect(this.master);
        this.musicFilter = this.ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 1200; this.musicFilter.connect(this.music);
        this.moodKey = ''; this.applyMood(); this.setVolume(this.volume, this.enabled);
      } catch { this.dispose(); return; }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => { });
    if (this.musicTimer === null) this.musicTimer = setInterval(() => this.updateMusic(), 100);
    this.updateMusic();
  }

  setVolume(volume: number, enabled: boolean) {
    if (this.disposed) return;
    this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0; this.enabled = enabled;
    const audible = enabled && this.volume > 0;
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      if (audible) {
        if (!this.outputConnected) { this.master.connect(this.ctx.destination); this.outputConnected = true; }
        this.master.gain.setTargetAtTime(this.volume, now, .025);
      } else {
        // A mute is exact silence across music, environmental cues and game effects.
        this.master.gain.setValueAtTime(0, now);
        if (this.outputConnected) { this.master.disconnect(this.ctx.destination); this.outputConnected = false; }
      }
    }
    if (!audible) {
      if (this.musicTimer !== null) clearInterval(this.musicTimer); this.musicTimer = null;
      this.stopScore(); this.ambience.reset(); this.ambientVoices.clear();
      this.active.forEach(source => { try { source.stop(); } catch { /* Already ended. */ } }); this.active.clear();
    } else if (this.ctx) {
      if (this.musicTimer === null) this.musicTimer = setInterval(() => this.updateMusic(), 100);
      this.updateMusic();
    }
  }

  setSoundscape(soundscape: Soundscape) {
    if (soundscape === this.soundscape) return;
    this.soundscape = soundscape; this.moodKey = '';
    this.stopScore(); this.applyMood(); this.updateMusic();
  }

  setWeather(weather: Weather) {
    this.mood.weather = weather; this.applyMood();
  }

  setMood(weather: Weather, combat: boolean, lowHealth: boolean, district: string) {
    this.mood = { weather, combat, lowHealth, district }; this.applyMood();
  }

  private applyMood() {
    this.ambience.weather = this.mood.weather; this.ambience.combat = this.mood.combat; this.trimAmbience();
    if (!this.ctx || !this.musicFilter) return;
    const { weather, combat, lowHealth, district } = this.mood;
    const key = `${this.soundscape}:${weather}:${combat}:${lowHealth}:${district}`; if (key === this.moodKey) return; this.moodKey = key;
    const roots = [98, 110, 123.47, 130.81];
    let hash = 0; for (let i = 0; i < district.length; i++) hash = (hash * 31 + district.charCodeAt(i)) >>> 0;
    const profile = SOUNDSCAPES[this.soundscape]; this.root = roots[hash % roots.length] * profile.scale;
    this.musicFilter.frequency.setTargetAtTime(profile.filter, this.ctx.currentTime, .12);
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
    const level = (this.mood.combat ? .7 : this.mood.lowHealth ? .85 : 1) * profile.gain;
    if (this.soundscape === 'river') {
      this.musicNote(profile.melody[index], start, 1.8, 'sine', .038 * level, .25);
      if (step % 4 === 0) chord.forEach(note => this.musicNote(note + 12, start, 2.8, 'sine', .012 * level, .35));
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
      if (step % 4 === 0) this.musicNote(chord[0], start, .2, 'sine', .04 * level);
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

  setEnvironmentActive(active: boolean) {
    this.environmentActive = active; if (!active) this.stopAmbience();
  }
  setCityFeature(kind: CityFeatureKind | null, distance: number) {
    this.ambience.setCity(kind, distance); this.trimAmbience();
  }
  setNearbyCreature(kind: 'cat' | 'dog' | null, distance: number) {
    this.ambience.setAnimal(kind, distance); this.trimAmbience();
  }
  private stopAmbience(kind?: AmbientKind) {
    if (!this.ctx) return;
    for (const [source, voice] of this.ambientVoices) {
      if (kind && voice.kind !== kind) continue;
      voice.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      voice.gain.gain.setTargetAtTime(0, this.ctx.currentTime, .008);
      try { source.stop(this.ctx.currentTime + .04); } catch { /* Already ended. */ }
      this.ambientVoices.delete(source);
    }
  }
  private trimAmbience() {
    const levels = this.ambience.levels();
    for (const voice of this.ambientVoices.values()) if (!levels[voice.kind]) this.stopAmbience(voice.kind);
  }
  updateCity(dt: number) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.enabled || this.volume <= 0 || !this.environmentActive) return;
    const cue = this.ambience.update(dt); if (!cue) return;
    this.lastAmbient = cue; this.ambientCount++; this.emitAmbient(cue);
  }
  private emitAmbient(cue: AmbientCue) {
    const tone = (frequency: number, duration: number, volume: number, end = frequency, delay = 0) => this.tone(frequency, duration, 'sine', volume * cue.level, end, delay, cue.kind);
    const noise = (duration: number, frequency: number, volume: number) => this.noise(duration, frequency, volume * cue.level, cue.kind);
    switch (cue.kind) {
      case 'rain': noise(1.1, 2400, .022); break;
      case 'wind': noise(.9, 550, .012); break;
      case 'store': tone(880, .16, .018); tone(1174, .26, .014, 1174, .16); break;
      case 'taxi':
        if (cue.variant < .25) { tone(310, .2, .012, 290); tone(390, .2, .008, 370); }
        else { tone(100, .5, .014, 155); noise(.35, 260, .009); } break;
      case 'youth': tone(1900, .08, .012, 2300); tone(2400, .1, .009, 2100, .1); break;
      case 'park': tone(2600, .08, .009, 3200); tone(3100, .06, .006, 3400, .15); break;
      case 'river':
        if (cue.variant < .3) { tone(130, .6, .014, 120); tone(196, .55, .007, 180); }
        else noise(.85, 1200, .016); break;
      case 'animal':
        if (cue.animal === 'dog') { tone(160, .13, .018, 110); noise(.1, 700, .012); }
        else tone(520, .22, .012, 300); break;
    }
  }

  get audioDebug() { return { soundscape: this.soundscape, scoreStep: this.scoreStep, scoreVoices: this.score.size, root: this.root,
    cityKind: this.ambience.city, cityLevel: this.ambience.levels()[this.ambience.city === 'bridge' ? 'river' : this.ambience.city as AmbientKind] ?? 0,
    ambientVoices: this.ambientVoices.size, ambientCount: this.ambientCount, lastAmbient: this.lastAmbient, environmentActive: this.environmentActive,
    enabled: this.enabled, volume: this.volume, outputConnected: this.outputConnected, masterLevel: this.master?.gain.value ?? 0, context: this.ctx?.state ?? 'locked' }; }

  private tone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = .1, end = frequency, delay = 0, ambient?: AmbientKind) {
    if (!this.ctx || !this.master || !this.enabled || this.volume <= 0 || volume <= 0 || this.disposed) return;
    const ctx = this.ctx, start = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(frequency, start); o.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(volume, start + .012); g.gain.exponentialRampToValueAtTime(Math.max(1e-8, Math.min(.0001, volume * .01)), start + duration);
    o.connect(g); g.connect(this.master); if (ambient) this.ambientVoices.set(o, { gain: g, kind: ambient }); o.start(start); o.stop(start + duration + .02); this.active.add(o);
    o.onended = () => { o.disconnect(); g.disconnect(); this.active.delete(o); this.ambientVoices.delete(o); };
  }

  private noise(duration: number, frequency: number, volume: number, ambient?: AmbientKind) {
    if (!this.ctx || !this.master || !this.noiseBuffer || !this.enabled || this.volume <= 0 || volume <= 0 || this.disposed) return;
    const ctx = this.ctx, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain(), now = ctx.currentTime;
    source.buffer = this.noiseBuffer; filter.type = 'lowpass'; filter.frequency.value = frequency;
    const floor = Math.max(1e-8, Math.min(.0001, volume * .01));
    gain.gain.setValueAtTime(ambient ? floor : volume, now);
    if (ambient) gain.gain.linearRampToValueAtTime(volume, now + Math.min(.12, duration * .3));
    gain.gain.exponentialRampToValueAtTime(floor, now + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); if (ambient) this.ambientVoices.set(source, { gain, kind: ambient });
    const maxOffset = Math.max(0, this.noiseBuffer.duration - duration); this.noiseOffset = (this.noiseOffset + .371) % Math.max(.01, maxOffset);
    source.start(now, this.noiseOffset, duration); source.stop(now + duration); this.active.add(source);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); this.active.delete(source); this.ambientVoices.delete(source); };
  }

  play(e: GameEvent, distance = 0) {
    if (!this.enabled || this.volume <= 0 || !this.ctx || this.disposed) return;
    switch (e.type) {
      case 'attack': this.noise(e.heavy ? .32 : .16, e.weapon === 'baton' ? 2400 : 1600, e.heavy ? .3 : .17); this.tone(e.heavy ? 105 : 180, .18, 'triangle', e.heavy ? .12 : .06, 60); break;
      case 'hit': this.noise(e.heavy ? .25 : .13, e.blocked ? 2600 : 1000, e.heavy ? .52 : .32); this.tone(e.blocked ? 620 : e.heavy ? 65 : 100, e.heavy ? .28 : .16, 'triangle', e.heavy ? .4 : .25, e.blocked ? 280 : 28); this.tone(780, .1, 'sine', .1, 180); break;
      case 'hurt': this.noise(.3, 480, .3); this.tone(130, .25, 'sawtooth', .12, 35); break;
      case 'dodge': this.noise(.24, 850, .22); break;
      case 'roar': {
        const range = e.kind === 'ebike' || e.kind === 'racer' ? 16 : 12;
        if (this.ctx.state !== 'running' || !this.environmentActive || distance >= range || this.ctx.currentTime < this.nextRoar) break;
        this.nextRoar = this.ctx.currentTime + 3 + Math.random() * 3;
        const level = (1 - Math.max(0, distance) / range) ** 2;
        if (e.kind === 'dog') { this.noise(.12, 700, .035 * level); this.tone(160, .18, 'triangle', .025 * level, 105); }
        else if (e.kind === 'cat') this.tone(510, .28, 'sine', .022 * level, 270);
        else if (e.kind === 'ebike' || e.kind === 'racer') { this.noise(.3, 820, .025 * level); this.tone(180, .35, 'triangle', .018 * level, 80); }
        else this.tone(120, .22, 'triangle', .018 * level, 80);
        break;
      }
      case 'pet': [440, 660, 880].forEach((f, i) => this.tone(f, .42, 'sine', .065, f * 1.08, i * .06)); break;
      case 'gather': case 'heal': [520, 650, 780].forEach((f, i) => this.tone(f, .5, 'sine', .07, f, i * .09)); break;
      case 'forge': this.noise(.2, 2200, .28); [390, 780, 1170].forEach(f => this.tone(f, 1, 'sine', .07)); break;
      case 'victory': [196, 247, 294, 392, 494].forEach((f, i) => this.tone(f, 1.7, 'triangle', .07, f, i * .18)); break;
      case 'step': this.noise(.085, 320, .075); break;
      case 'weather': break;
    }
  }

  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.master?.disconnect(); this.outputConnected = false;
    if (this.musicTimer !== null) clearInterval(this.musicTimer); this.musicTimer = null;
    this.stopScore(); this.score.forEach((gain, voice) => { voice.disconnect(); gain.disconnect(); }); this.score.clear();
    this.active.forEach(n => { try { n.stop(); } catch { /* Already ended. */ } }); this.active.clear();
    this.ambientVoices.clear(); this.ambience.reset();
    if (this.ctx) void this.ctx.close().catch(() => { }); this.ctx = null;
  }
}
