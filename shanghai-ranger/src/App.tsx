import { HERO_MAX_LEVEL, heroUpgradeCost } from './game/heroProgress';
import { HeroPortrait } from './components/HeroPortrait';
import { Check } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Compass, GearSix, MapTrifold, PawPrint, Question, SpeakerHigh, SpeakerSlash, Wrench } from '@phosphor-icons/react';
import { Engine } from './game/engine';
import type { Shortcut } from './game/engine';
import { Simulation, PETS, ROSTER, SAVE_KEY, readProgress } from './game/simulation';
import type { Gender, Pet, Settings, Snapshot } from './game/types';
import { Emblem, SkylineArt } from './components/Emblem';
import { Hud, Key } from './components/Hud';
import { Modal, ResultOverlay } from './components/Modals';
import { createGameStorage } from './game/storage';
import type { GameStorage, MiniToolHost } from './game/storage';
import { version as APP_VERSION } from '../package.json';
import { RecoveryEffects, useDeathFeedback } from './components/RecoveryEffects';
import { RECOVERY, availableRecoveryUpgrade } from './game/recovery';

export type ModalName = 'map' | 'guide' | 'forge' | 'settings' | 'help' | 'pets' | 'wardrobe';
const DEFAULT_SETTINGS: Settings = { sound: true, volume: .45, soundscape: 'neon', quality: 'balanced', sensitivity: 1, reducedMotion: false, enemyHealthBars: true };
function loadSettings(raw: string | null): Settings {
  try { const s = JSON.parse(raw || 'null'); if (!s) return DEFAULT_SETTINGS; return { sound: typeof s.sound === 'boolean' ? s.sound : true, volume: typeof s.volume === 'number' ? Math.max(0, Math.min(1, s.volume)) : .45, soundscape: s.soundscape === 'jazz' || s.soundscape === 'river' || s.soundscape === 'radio' ? s.soundscape : 'neon', quality: s.quality === 'high' || s.quality === 'low' ? s.quality : 'balanced', sensitivity: typeof s.sensitivity === 'number' ? Math.max(.3, Math.min(2, s.sensitivity)) : 1, reducedMotion: s.reducedMotion === true, enemyHealthBars: s.enemyHealthBars !== false }; } catch { return DEFAULT_SETTINGS; }
}

export default function App() {
  const sceneRef = useRef<HTMLDivElement>(null), engineRef = useRef<Engine | null>(null), modalRef = useRef<ModalName | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => new Simulation().snapshot());
  const [modal, setModal] = useState<ModalName | null>(null), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [loading, setLoading] = useState(8), [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const storageRef = useRef<GameStorage | null>(null), settingsRevision = useRef(0);
  const [settingsSaved, setSettingsSaved] = useState(true);
  const [welcome, setWelcome] = useState(true), [dismissedResult, setDismissedResult] = useState(false);
  const deathFeedbackComplete = useDeathFeedback(snapshot.dead, ready);
  const [reviving, setReviving] = useState(false);
  const recoveryReadyRef = useRef(false), recoveryPending = useRef(false), recoveryTimers = useRef<number[]>([]);
  recoveryReadyRef.current = deathFeedbackComplete;
  const [compactHud, setCompactHud] = useState(false);
  const [gender, setGender] = useState<Gender>('male');
  const [pet, setPet] = useState<Pet>(snapshot.progress.pet);
  const settingsRef = useRef(settings); settingsRef.current = settings; modalRef.current = modal;
  const open = useCallback((name: ModalName) => {
    if (recoveryPending.current || (engineRef.current?.simulation.dead && (!recoveryReadyRef.current || name !== 'forge'))) return;
    setModal(current => current === name ? null : name);
  }, []);
  const shortcut = useCallback((key: Shortcut) => {
    if (recoveryPending.current) return;
    if (key === 'escape') setModal(current => current ? null : engineRef.current?.simulation.dead ? null : 'settings');
    else open(key);
  }, [open]);
  const persistSettings = useCallback(async (value: Settings) => {
    if (!storageRef.current) return;
    const revision = ++settingsRevision.current;
    try { await storageRef.current.set('nightwatch-settings', JSON.stringify(value)); if (revision === settingsRevision.current) setSettingsSaved(true); }
    catch { if (revision === settingsRevision.current) setSettingsSaved(false); }
  }, []);
  useEffect(() => {
    if (!sceneRef.current) return;
    let engine: Engine | undefined, cancelled = false;
    void (async () => {
      try {
        let browser: Storage | undefined; try { browser = window.localStorage; } catch { /* Native storage can still work. */ }
        const storage = await createGameStorage((window as Window & { xhs?: MiniToolHost }).xhs, browser);
        const [saved, savedSettings] = await Promise.all([storage.get(SAVE_KEY), storage.get('nightwatch-settings')]);
        if (cancelled || !sceneRef.current) return;
        storageRef.current = storage;
        const loaded = loadSettings(savedSettings); settingsRef.current = loaded; setSettings(loaded);
        const progress = readProgress(saved);
        setGender(progress.gender ?? 'male');
        if (progress.patrol?.dead || progress.patrol?.phase === 'complete' || (progress.patrol?.rescueTime ?? 0) > 0) setWelcome(false);
        engine = new Engine(sceneRef.current, loaded, { snapshot: setSnapshot, ready: () => setReady(true), error: setError, shortcut, progress: setLoading }, { progress, save: p => storage.set(SAVE_KEY, JSON.stringify(p)), label: storage.label });
        engineRef.current = engine;
        if (import.meta.env.DEV) (window as unknown as { __nightwatch: Engine | undefined }).__nightwatch = engine;
      } catch (e) { if (!cancelled) setError(e instanceof Error && e.message.includes('WebGL') ? '3D 画面暂不可用。请使用支持 WebGL 2 的浏览器，重新加载后再试。' : e instanceof Error ? e.message : '暂时无法读取本地存档，请重新加载后重试。'); }
    })();
    return () => { cancelled = true; engine?.dispose(); engineRef.current = null; storageRef.current = null; if (import.meta.env.DEV) delete (window as unknown as { __nightwatch?: Engine }).__nightwatch; };
  }, [shortcut]);
  const result = snapshot.dead || (snapshot.questPhase === 'complete' && !dismissedResult);
  useEffect(() => () => { recoveryTimers.current.forEach(window.clearTimeout); }, []);
  useEffect(() => { if (snapshot.questPhase === 'tracking') setDismissedResult(false); }, [snapshot.questPhase]);
  useEffect(() => { setPet(snapshot.progress.pet); }, [snapshot.progress.pet]);
  useEffect(() => { engineRef.current?.setPaused(Boolean(modal) || welcome || result || reviving || !ready || Boolean(error)); }, [modal, welcome, result, reviving, ready, error]);
  useEffect(() => { engineRef.current?.setSettings(settings); persistSettings(settings); }, [settings, persistSettings]);
  const progressFailed = snapshot.saveStatus === 'failed';
  const retrySave = () => {
    const focused = document.activeElement;
    if (progressFailed) { engineRef.current?.simulation.retrySave(); engineRef.current?.publish(); }
    if (!settingsSaved) persistSettings(settings);
    requestAnimationFrame(() => {
      if (focused && !focused.isConnected && document.activeElement === document.body) {
        (document.querySelector<HTMLButtonElement>('[role="dialog"] button') ?? document.querySelector<HTMLButtonElement>('.error-content>.primary-button'))?.focus();
      }
    });
  };
  const reset = () => { setDismissedResult(false); setModal(null); engineRef.current?.reset(); };
  const retryEncounter = () => {
    if (!engineRef.current?.simulation.dead || !deathFeedbackComplete || recoveryPending.current) return;
    recoveryPending.current = true; setReviving(true); setModal(null);
    recoveryTimers.current = [
      window.setTimeout(() => { engineRef.current?.retryEncounter(); }, RECOVERY.transitionSeconds * 500),
      window.setTimeout(() => { recoveryPending.current = false; setReviving(false); recoveryTimers.current = []; engineRef.current?.renderer.domElement.focus({ preventScroll: true }); }, RECOVERY.transitionSeconds * 1000),
    ];
  };
  const saveWarning = (progressFailed || !settingsSaved) && <aside className="save-warning" role="alert"><div><strong>{progressFailed ? settingsSaved ? '进度未保存' : '进度和设置未保存' : '设置未保存'}</strong><p>{progressFailed ? '进度仅本次有效，刷新后会丢失未保存的成长。' : '当前设置仅本次有效，刷新后会恢复原设置。'}</p><small>请检查存储权限或可用空间，恢复后重试。</small></div><button autoFocus={Boolean(error)} onClick={retrySave}>重试保存</button></aside>;
  const upgradeCost = heroUpgradeCost(snapshot.progress.level);
  const upgradeReady = (snapshot.progress.level < HERO_MAX_LEVEL && snapshot.progress.parts >= upgradeCost.parts && snapshot.progress.cash >= upgradeCost.cash) || availableRecoveryUpgrade(snapshot.progress) === 'weapon';
  const currentTarget = ROSTER[snapshot.progress.hunts % ROSTER.length];
  return <main className={`game-shell ${ready ? 'is-ready' : ''} ${welcome ? 'is-welcome' : ''} ${error ? 'has-error' : ''} ${settings.reducedMotion ? 'reduced-motion' : ''} ${compactHud ? 'hud-compact' : ''} ${snapshot.dead ? 'is-fallen' : ''} ${reviving ? 'is-reviving' : ''}`}>
    <div className="scene-container" ref={sceneRef} />
    <div className="cinematic-shade" />
    <header className="topbar" inert={snapshot.dead || reviving || Boolean(error)}>
      <button className="brand" onClick={() => setModal(null)} aria-label="返回夜巡"><Emblem /><span><small>沪上</small><strong>游侠</strong><span className="brand-tagline">SHANGHAI RANGER</span></span></button>
      <nav className="main-nav" aria-label="游戏导航">
        <button className={!modal ? 'active' : ''} onClick={() => setModal(null)} aria-label="夜巡"><Compass size={16} /><span>夜巡</span></button>
        <button className={modal === 'map' ? 'active' : ''} onClick={() => open('map')} aria-label="街区地图"><MapTrifold size={16} /><span>街区地图</span><Key>M</Key></button>
        <button className={modal === 'guide' ? 'active' : ''} onClick={() => open('guide')} aria-label="夜巡手册"><BookOpen size={16} /><span>夜巡手册</span><Key>G</Key></button>
        <button className={modal === 'forge' ? 'active' : ''} onClick={() => open('forge')} aria-label="强化所"><Wrench size={16} /><span>强化所</span><Key>F</Key>{upgradeReady && <i className="forge-ready-dot" />}</button>
        <button className={modal === 'pets' ? 'active' : ''} onClick={() => open('pets')} aria-label="江湖宠物"><PawPrint size={16} /><span>宠物</span><Key>P</Key></button>
      </nav>
      <div className="top-actions"><button className="hud-toggle" onClick={() => setCompactHud(value => !value)} aria-label={compactHud ? '显示完整状态界面' : '精简状态界面'} aria-pressed={compactHud}>{compactHud ? '完整' : '精简'}</button><span className="solo-label"><span />v{APP_VERSION}</span><button onClick={() => { const sound = !settings.sound; engineRef.current?.audio.setVolume(settings.volume, sound); if (sound) engineRef.current?.audio.unlock(); setSettings({ ...settings, sound }); }} aria-label={settings.sound ? '关闭声音' : '开启声音'} title={settings.sound ? '关闭声音' : '开启声音'}>{settings.sound ? <SpeakerHigh size={19} /> : <SpeakerSlash size={19} />}</button><span className="action-divider" /><button onClick={() => open('settings')} aria-label="打开设置" title="设置"><GearSix size={20} /></button></div>
    </header>
    {ready && !error && <Hud s={snapshot} engine={engineRef.current} open={open} settings={settings} paused={Boolean(modal) || welcome || result || !ready} />}

    {ready && welcome && !modal && !result && !error && <section className="nightwatch-start">
      <div className="nightwatch-page">
        <span className="nightwatch-tab">夜巡档案 / 01</span>
        <h1>沪上<br />游侠</h1>
        <p className="nightwatch-deck">上海 · 夜巡档案</p>
        <div className="nightwatch-specimen"><SkylineArt /><small>上海 · 外滩 — 陆家嘴 天际线</small></div>
        <div className="nightwatch-seal">夜巡<br />档</div>
      </div>
      <div className="nightwatch-notes">
        <span>街坊委托 · 今晚的目标</span>
        <h2>准备夜巡</h2>
        <p>循着线索制伏祸害，带上你的伙伴出发。</p>
        <div className="target-card"><PawPrint size={15} /><span>{snapshot.questDistrict} · {snapshot.monsterElite ? '精英夜' : '街坊委托'}<strong>{currentTarget.title} · 悬赏 {snapshot.questReward} 元</strong></span></div>
        <div className="gender-select" role="radiogroup" aria-label="选择主角性别"><span className="selection-label">主角外观</span><div className="gender-picker">{(['male', 'female'] as Gender[]).map(value => <button key={value} role="radio" aria-checked={gender === value} disabled={!engineRef.current?.simulation.canChangeAppearance && value !== snapshot.progress.gender} className={gender === value ? 'active' : ''} onClick={() => setGender(value)}><HeroPortrait skin={snapshot.progress.skin} gender={value}/><span>{value === 'male' ? '男' : '女'}</span>{gender === value && <Check size={17}/>}</button>)}</div></div>
        <div className="pet-select" role="radiogroup" aria-label="选择你的江湖宠物">
          <span className="pet-select-label"><PawPrint size={13} />选一只宠物陪你夜巡</span>
          <div className="pet-picker">{PETS.map(p => <button key={p.id} role="radio" disabled={snapshot.combat && p.id !== snapshot.progress.pet} aria-checked={pet === p.id} className={pet === p.id ? 'active' : ''} onClick={() => setPet(p.id)}><span className={`pet-face pet-${p.id}`} /><span>{p.name}</span><small>{p.desc}</small></button>)}</div>
        </div>
        <button className="primary-button" onClick={() => { if (engineRef.current && gender !== engineRef.current.simulation.progress.gender) engineRef.current.setGender(gender); if (engineRef.current && pet !== engineRef.current.simulation.progress.pet) engineRef.current.setPet(pet); setWelcome(false); engineRef.current?.audio.unlock(); }}>{snapshot.time > 0 || snapshot.tracked > 0 ? '继续夜巡' : '开始夜巡'} <ArrowRight size={18} /></button>
        <p className="nightwatch-controls">WASD 移动 · J 攻击 · 空格 闪避 · E 交互 · C 宠物技</p>
      </div>
    </section>}

    <button className="help-corner" disabled={snapshot.dead || reviving || Boolean(error)} onClick={() => open('help')} aria-label="玩法说明"><Question size={17} /></button>
    <RecoveryEffects dead={snapshot.dead} complete={deathFeedbackComplete} reviving={reviving} protection={snapshot.recoveryProtection}/>
    {modal && !reviving && !error && <Modal key={modal} modal={modal} s={snapshot} engine={engineRef.current} settings={settings} setSettings={setSettings} saveWarning={saveWarning} close={() => setModal(null)} open={open} retry={retryEncounter} />}
    {result && !modal && !reviving && !error && (!snapshot.dead || deathFeedbackComplete) && <ResultOverlay s={snapshot} saveWarning={saveWarning} retry={snapshot.dead ? retryEncounter : reset} forge={() => { setDismissedResult(true); setModal('forge'); }} continueHunt={() => setDismissedResult(true)} />}
    {!ready && !error && <div className="loading-screen"><div className="loading-brand"><Emblem /><span className="eyebrow">沪上游侠</span><h1>夜巡</h1><p>一座等你守护的夜色街区。</p><div className="loading-track"><span style={{ transform: `scaleX(${loading / 100})` }} /></div><div className="loading-caption"><span>正在进入上海夜色街区</span><span>{loading}%</span></div><small>江湖路远，一碗馄饨热。</small></div></div>}
    {error && <div className="loading-screen"><div className="error-content" aria-labelledby="error-title"><Emblem /><h2 id="error-title">暂时无法进入夜巡</h2><p>{error}</p>{saveWarning}<button className="primary-button" autoFocus={!saveWarning} onClick={() => location.reload()}>重新加载<ArrowRight size={17} /></button>{!error.includes('存档') && <small>请使用支持 WebGL 2 的浏览器进入3D街区。</small>}</div></div>}
    {!modal && !result && !error && saveWarning}
    <div className="sr-only" aria-live="polite">{snapshot.dead ? deathFeedbackComplete ? '可以再试一次，调查和物品都保留。' : '暂时倒下了，调查和物品都保留。' : snapshot.questPhase === 'complete' ? snapshot.saveStatus === 'saved' ? '本轮夜巡完成，奖励已入账并自动存档。' : '本轮夜巡完成，奖励已结算，进度尚未保存。' : ''}</div>
  </main>;
}
