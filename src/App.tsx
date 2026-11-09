import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Compass, GearSix, MapTrifold, PawPrint, Question, SpeakerHigh, SpeakerSlash, Wrench } from '@phosphor-icons/react';
import { Engine } from './game/engine';
import type { Shortcut } from './game/engine';
import { Simulation, PETS, ROSTER } from './game/simulation';
import type { Pet, Settings, Snapshot } from './game/types';
import { Emblem, SkylineArt } from './components/Emblem';
import { Hud, Key } from './components/Hud';
import { Modal, ResultOverlay } from './components/Modals';

export type ModalName = 'map' | 'guide' | 'forge' | 'settings' | 'help';
const DEFAULT_SETTINGS: Settings = { sound: true, volume: .45, soundscape: 'neon', quality: 'high', sensitivity: 1, reducedMotion: false };
function loadSettings(): Settings {
  try { const s = JSON.parse(localStorage.getItem('nightwatch-settings') || 'null'); if (!s) return DEFAULT_SETTINGS; return { sound: typeof s.sound === 'boolean' ? s.sound : true, volume: typeof s.volume === 'number' ? Math.max(0, Math.min(1, s.volume)) : .45, soundscape: s.soundscape === 'jazz' || s.soundscape === 'river' || s.soundscape === 'radio' ? s.soundscape : 'neon', quality: s.quality === 'balanced' || s.quality === 'low' ? s.quality : 'high', sensitivity: typeof s.sensitivity === 'number' ? Math.max(.3, Math.min(2, s.sensitivity)) : 1, reducedMotion: s.reducedMotion === true }; } catch { return DEFAULT_SETTINGS; }
}

export default function App() {
  const sceneRef = useRef<HTMLDivElement>(null), engineRef = useRef<Engine | null>(null), modalRef = useRef<ModalName | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => new Simulation().snapshot());
  const [modal, setModal] = useState<ModalName | null>(null), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [loading, setLoading] = useState(8), [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsSaved, setSettingsSaved] = useState(true);
  const [welcome, setWelcome] = useState(true), [dismissedResult, setDismissedResult] = useState(false);
  const [compactHud, setCompactHud] = useState(false);
  const [pet, setPet] = useState<Pet>(snapshot.progress.pet);
  const settingsRef = useRef(settings); settingsRef.current = settings; modalRef.current = modal;
  const open = useCallback((name: ModalName) => setModal(current => current === name ? null : name), []);
  const shortcut = useCallback((key: Shortcut) => { if (key === 'escape') setModal(current => current ? null : 'settings'); else open(key); }, [open]);
  const persistSettings = useCallback((value: Settings) => {
    try { localStorage.setItem('nightwatch-settings', JSON.stringify(value)); setSettingsSaved(true); }
    catch { setSettingsSaved(false); }
  }, []);
  useEffect(() => {
    if (!sceneRef.current) return;
    let engine: Engine | undefined;
    try {
      engine = new Engine(sceneRef.current, settingsRef.current, { snapshot: setSnapshot, ready: () => setReady(true), error: setError, shortcut, progress: setLoading });
      engineRef.current = engine;
      if (import.meta.env.DEV) (window as unknown as { __nightwatch: Engine | undefined }).__nightwatch = engine;
    } catch (e) { setError(e instanceof Error ? e.message : '你的浏览器无法启动3D街区。'); }
    return () => { engine?.dispose(); engineRef.current = null; if (import.meta.env.DEV) delete (window as unknown as { __nightwatch?: Engine }).__nightwatch; };
  }, [shortcut]);
  const result = snapshot.dead || (snapshot.questPhase === 'complete' && !dismissedResult);
  useEffect(() => { if (snapshot.questPhase === 'tracking') setDismissedResult(false); }, [snapshot.questPhase]);
  useEffect(() => { setPet(snapshot.progress.pet); }, [snapshot.progress.pet]);
  useEffect(() => { engineRef.current?.setPaused(Boolean(modal) || welcome || result || !ready); }, [modal, welcome, result, ready]);
  useEffect(() => { engineRef.current?.setSettings(settings); persistSettings(settings); }, [settings, persistSettings]);
  const progressFailed = snapshot.saveStatus === 'failed';
  const retrySave = () => {
    const focused = document.activeElement;
    if (progressFailed) { engineRef.current?.simulation.retrySave(); engineRef.current?.publish(); }
    if (!settingsSaved) persistSettings(settings);
    requestAnimationFrame(() => {
      if (focused && !focused.isConnected && document.activeElement === document.body) {
        document.querySelector<HTMLButtonElement>('[role="dialog"] button')?.focus();
      }
    });
  };
  const reset = () => { setDismissedResult(false); setModal(null); engineRef.current?.reset(); };
  const saveWarning = (progressFailed || !settingsSaved) && <aside className="save-warning" role="alert"><div><strong>{progressFailed ? settingsSaved ? '进度未保存' : '进度和设置未保存' : '设置未保存'}</strong><p>{progressFailed ? '进度仅本次有效，刷新后会丢失未保存的成长。' : '当前设置仅本次有效，刷新后会恢复原设置。'}</p><small>请检查浏览器存储权限或可用空间，再重试。</small></div><button onClick={retrySave}>重试保存</button></aside>;
  const currentTarget = ROSTER[snapshot.progress.hunts % ROSTER.length];
  return <main className={`game-shell ${ready ? 'is-ready' : ''} ${settings.reducedMotion ? 'reduced-motion' : ''} ${compactHud ? 'hud-compact' : ''}`}>
    <div className="scene-container" ref={sceneRef} />
    <div className="cinematic-shade" />
    <header className="topbar">
      <button className="brand" onClick={() => setModal(null)} aria-label="返回夜巡"><Emblem /><span><small>沪上</small><strong>游侠</strong><span className="brand-tagline">SHANGHAI RANGER</span></span></button>
      <nav className="main-nav" aria-label="游戏导航">
        <button className={!modal ? 'active' : ''} onClick={() => setModal(null)} aria-label="夜巡"><Compass size={16} /><span>夜巡</span></button>
        <button className={modal === 'map' ? 'active' : ''} onClick={() => open('map')} aria-label="街区地图"><MapTrifold size={16} /><span>街区地图</span><Key>M</Key></button>
        <button className={modal === 'guide' ? 'active' : ''} onClick={() => open('guide')} aria-label="夜巡手册"><BookOpen size={16} /><span>夜巡手册</span><Key>G</Key></button>
        <button className={modal === 'forge' ? 'active' : ''} onClick={() => open('forge')} aria-label="强化所"><Wrench size={16} /><span>强化所</span><Key>F</Key>{snapshot.progress.parts >= 4 && <i className="forge-ready-dot" />}</button>
      </nav>
      <div className="top-actions"><button className="hud-toggle" onClick={() => setCompactHud(value => !value)} aria-label={compactHud ? '显示完整状态界面' : '精简状态界面'} aria-pressed={compactHud}>{compactHud ? '完整' : '精简'}</button><span className="solo-label"><span />单人夜巡</span><button onClick={() => { engineRef.current?.audio.unlock(); setSettings({ ...settings, sound: !settings.sound }); }} aria-label={settings.sound ? '关闭声音' : '开启声音'} title={settings.sound ? '关闭声音' : '开启声音'}>{settings.sound ? <SpeakerHigh size={19} /> : <SpeakerSlash size={19} />}</button><span className="action-divider" /><button onClick={() => open('settings')} aria-label="打开设置" title="设置"><GearSix size={20} /></button></div>
    </header>
    {ready && <Hud s={snapshot} engine={engineRef.current} open={open} paused={Boolean(modal) || welcome || result || !ready} />}

    {ready && welcome && !modal && !result && <section className="nightwatch-start">
      <div className="nightwatch-page">
        <span className="nightwatch-tab">夜巡档案 / 01</span>
        <h1>沪上<br />游侠</h1>
        <p className="nightwatch-deck">霓虹与梧桐之间的都市侠客传说。</p>
        <div className="nightwatch-specimen"><SkylineArt /><small>上海 · 外滩 — 陆家嘴 天际线</small></div>
        <div className="nightwatch-seal">夜巡<br />档</div>
      </div>
      <div className="nightwatch-notes">
        <span>街坊委托 · 今晚的目标</span>
        <h2>夜色越深，<br />越要有人巡。</h2>
        <p>野猫翻包、野狗乱扑、无牌电驴逆行、鬼火少年炸街……这座城市的讨厌东西，今晚由你收拾。带上兵器，领上宠物，出发。</p>
        <div className="target-card"><PawPrint size={15} /><span>{snapshot.questDistrict} · {snapshot.monsterElite ? '精英夜' : '街坊委托'}<strong>{currentTarget.title} · 悬赏 {snapshot.questReward} 元</strong></span></div>
        <div className="pet-select" role="radiogroup" aria-label="选择你的江湖宠物">
          <span className="pet-select-label"><PawPrint size={13} />选一只宠物陪你夜巡</span>
          <div className="pet-picker">{PETS.map(p => <button key={p.id} role="radio" aria-checked={pet === p.id} className={pet === p.id ? 'active' : ''} onClick={() => setPet(p.id)}><span className={`pet-face pet-${p.id}`} /><span>{p.name}</span><small>{p.desc}</small></button>)}</div>
        </div>
        <button className="primary-button" onClick={() => { if (engineRef.current && pet !== engineRef.current.simulation.progress.pet) engineRef.current.setPet(pet); setWelcome(false); engineRef.current?.audio.unlock(); }}>开始夜巡 <ArrowRight size={18} /></button>
        <p className="nightwatch-controls">WASD 移动 · J 攻击 · 空格 闪避 · E 交互 · C 宠物技</p>
      </div>
    </section>}

    <button className="help-corner" onClick={() => open('help')} aria-label="玩法说明"><Question size={17} /></button>
    {modal && <Modal key={modal} modal={modal} s={snapshot} engine={engineRef.current} settings={settings} setSettings={setSettings} saveWarning={saveWarning} close={() => setModal(null)} open={open} />}
    {result && !modal && <ResultOverlay s={snapshot} saveWarning={saveWarning} retry={reset} forge={() => { setDismissedResult(true); setModal('forge'); }} continueHunt={() => setDismissedResult(true)} />}
    {!ready && !error && <div className="loading-screen"><div className="loading-brand"><Emblem /><span className="eyebrow">沪上游侠</span><h1>夜巡</h1><p>一座等你守护的夜色街区。</p><div className="loading-track"><span style={{ transform: `scaleX(${loading / 100})` }} /></div><div className="loading-caption"><span>正在进入上海夜色街区</span><span>{loading}%</span></div><small>江湖路远，一碗馄饨热。</small></div></div>}
    {error && <div className="loading-screen"><div className="error-content"><Emblem /><h2>夜巡还需片刻。</h2><p>{error}</p><button className="primary-button" onClick={() => location.reload()}>重新加载<ArrowRight size={17} /></button><small>请使用支持 WebGL 2 的浏览器进入3D街区。</small></div></div>}
    {!modal && !result && saveWarning}
    <div className="sr-only" aria-live="polite">{snapshot.questPhase === 'complete' ? snapshot.saveStatus === 'saved' ? '本轮夜巡完成，奖励已入账并自动存档。' : '本轮夜巡完成，奖励已结算，进度尚未保存。' : snapshot.dead ? '你倒下了，宠物把你拖回了大排档。可以重新开始。' : ''}</div>
  </main>;
}
