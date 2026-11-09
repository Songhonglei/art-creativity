import { useEffect, useRef } from 'react';
import { ArrowRight, BookOpen, CaretRight, Check, CircleNotch, Compass, Crosshair, Diamond, Feather, Flask, Footprints, HandCoins, Heart, MapTrifold, MoonStars, MouseLeftClick, PawPrint, Skull, Star, Sword, Wrench, Wind, CloudFog, CloudRain } from '@phosphor-icons/react';
import { MonsterGlyph } from './Emblem';
import { WorldMap } from './WorldMap';
import { PET_NAMES, WEAPONS } from '../game/simulation';
import { districtName } from '../game/districts';
import type { Settings, Snapshot } from '../game/types';
import type { Engine } from '../game/engine';
import type { ModalName } from '../App';

export const Key = ({ children }: { children: React.ReactNode }) => <kbd>{children}</kbd>;
const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function CompassStrip({ heading }: { heading: number }) {
  const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  return <div className="compass-strip" aria-label={`罗盘 · ${Math.round(heading)} 度`}><div className="compass-track">{Array.from({ length: 15 }, (_, i) => {
    const raw = (Math.floor(heading / 15) - 7 + i) * 15, value = (raw % 360 + 360) % 360, major = value % 45 === 0;
    return <span key={raw} className={`compass-mark ${major ? 'major' : ''}`} style={{ transform: `translateX(${(raw - heading) * 2.6}px)` }}><span>{major ? directions[value / 45] : value}</span><i /></span>;
  })}</div><b>◆</b></div>;
}

function TouchJoystick({ engine, paused }: { engine: Engine | null; paused: boolean }) {
  const base = useRef<HTMLDivElement>(null), knob = useRef<HTMLSpanElement>(null), active = useRef<number | null>(null);
  useEffect(() => {
    const clear = () => {
      const id = active.current; active.current = null; engine?.setTouch(0, 0);
      if (id !== null && base.current?.hasPointerCapture?.(id)) base.current.releasePointerCapture(id);
      if (knob.current) knob.current.style.transform = 'translate(-50%, -50%)';
    };
    if (paused) clear();
    window.addEventListener('blur', clear); window.addEventListener('resize', clear); document.addEventListener('visibilitychange', clear);
    return () => { clear(); window.removeEventListener('blur', clear); window.removeEventListener('resize', clear); document.removeEventListener('visibilitychange', clear); };
  }, [engine, paused]);
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (active.current !== e.pointerId || !base.current) return;
    const rect = base.current.getBoundingClientRect(), max = rect.width * .31;
    const dx = e.clientX - rect.left - rect.width / 2, dy = e.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(dx, dy), scale = length > max ? max / length : 1;
    const x = dx * scale, y = dy * scale, nx = x / max, nz = y / max;
    if (knob.current) knob.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    engine?.setTouch(nx, nz, Math.hypot(nx, nz) > .86);
  };
  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (active.current !== e.pointerId) return;
    active.current = null; engine?.setTouch(0, 0);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (knob.current) knob.current.style.transform = 'translate(-50%, -50%)';
  };
  return <div ref={base} className="touch-move touch-joystick" role="group" aria-label="移动摇杆，拖动摇杆移动，推至边缘疾跑"
    onPointerDown={e => { e.preventDefault(); if (paused || active.current !== null) return; active.current = e.pointerId; e.currentTarget.setPointerCapture?.(e.pointerId); move(e); }}
    onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
    <span className="joystick-ring" /><span ref={knob} className="joystick-knob"><Compass size={22} weight="light" /></span>
    <small>移动 · 推满疾跑</small>
  </div>;
}

export function Hud({ s, engine, open, paused, settings }: { s: Snapshot; engine: Engine | null; open: (m: ModalName) => void; paused: boolean; settings: Settings }) {
  // Non-primary touch contacts must trigger skills while the first thumb stays on the joystick.
  // Pointer press handles mouse/touch; only keyboard-generated clicks take the click path.
  const actionHandlers = (action: Parameters<Engine['action']>[0]) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); if (!paused) engine?.action(action);
    },
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => { if (!paused && e.detail === 0) engine?.action(action); },
  });
  const phase = s.questPhase, slain = phase === 'harvest' || phase === 'complete';
  const WeatherIcon = s.weather === '晴夜' ? MoonStars : s.weather === '雾霾' ? CloudFog : CloudRain;
  const weaponName = WEAPONS.find(weapon => weapon.id === s.progress.weapon)?.name ?? '城市战术棍';
  const enemy = s.encounter;
  return <div className={`hud ${s.combat ? 'in-combat' : ''}`}>
    <section className="hunter-status" aria-label="侠客状态">
      <div className="hunter-sigil"><Sword size={25} weight="light" /><span>01</span></div>
      <div className="hunter-details">
        <div className="hunter-name"><strong>夜鹰</strong><span>侠义等级 {String(s.progress.level).padStart(2, '0')}</span></div>
        <div className="vital-line"><Heart size={12} weight="fill" /><div className="vital health" role="progressbar" aria-label="气血" aria-valuenow={Math.round(s.health)} aria-valuemin={0} aria-valuemax={s.maxHealth}><i style={{ transform: `scaleX(${s.health / s.maxHealth})` }} /></div><span>{Math.ceil(s.health)}<small> / {s.maxHealth}</small></span></div>
        <div className="vital-line stamina-line"><Feather size={12} /><div className="vital stamina" role="progressbar" aria-label="体力" aria-valuenow={Math.round(s.stamina)} aria-valuemin={0} aria-valuemax={100}><i style={{ transform: `scaleX(${s.stamina / 100})` }} /></div></div>
        <div className="companion-status"><PawPrint size={11} weight="fill" /><span>{PET_NAMES[s.progress.pet]} · 训练 {s.progress.petLevel}</span><span className="companion-line" /><small>{s.petSkillName}</small></div>
      </div>
    </section>

    <CompassStrip heading={s.heading} />

    <section className={`weather-widget weather-${s.weather}`} aria-label="当前天气">
      <div className="weather-main"><WeatherIcon size={32} weight="light" /><div><div className="eyebrow">魔都天象</div><h3>{s.weather}<span className="weather-dot" /></h3></div><span className="temperature">{s.weather === '晴夜' ? '21°' : s.weather === '雾霾' ? '27°' : '19°'}</span></div>
      <p>{s.weather === '晴夜' ? '月色混着霓虹，照得街区发亮。' : s.weather === '雾霾' ? '雾气沉沉，体力恢复变慢。' : '暴雨如注，目标动作更快。'}</p>
      <div className="weather-timeline"><span className={s.weather === '晴夜' ? 'active' : ''} /><span className={s.weather === '雾霾' ? 'active' : ''} /><span className={s.weather === '暴雨' ? 'active' : ''} /></div>
      <div className="weather-meta"><Wind size={11} /><span>{s.weather === '晴夜' ? '东南 · 3' : s.weather === '雾霾' ? '北 · 9' : '东 · 22'} 公里/时</span><span>变化倒计时 {formatTime((1 - s.weatherProgress) * 100)}</span></div>
    </section>

    <section className="quest-tracker">
      <div className="eyebrow gold"><Diamond size={11} weight="fill" />街坊委托 · {s.questDistrict}<span className="quest-rule" /></div>
      <h1>夜色<br />巡逻</h1>
      <p className="quest-subtitle">{s.targetRevealed ? `目标已现身 · 悬赏 ${s.questReward} 元` : '先搜集痕迹，再追踪目标。'}</p>
      <div className="quest-difficulty"><Star weight="fill" /><Star weight="fill" /><Star weight={s.monsterElite ? 'fill' : 'regular'} /><span>{s.monsterElite ? `精英夜 · ${s.questReward} 元` : `夜巡任务 · ${s.questReward} 元`}</span></div>
      <div className="quest-steps">
        <div className={s.tracked === 3 ? 'done' : phase === 'tracking' ? 'current' : ''}><span className="step-icon">{s.tracked === 3 ? <Check /> : <Footprints />}</span><span>收集三条线索</span><small>{s.tracked}/3</small></div>
        <div className={slain ? 'done' : phase === 'hunting' ? 'current' : ''}><span className="step-icon">{slain ? <Check /> : <Crosshair />}</span><span>制伏{s.monsterName}</span></div>
        <div className={phase === 'complete' ? 'done' : phase === 'harvest' ? 'current' : ''}><span className="step-icon">{phase === 'complete' ? <Check /> : <HandCoins />}</span><span>收缴赃物</span></div>
      </div>
      {phase === 'complete' ? <button className="text-button quest-details next-expedition" onClick={() => engine?.reset()}>下一轮夜巡 <ArrowRight size={13} /></button> : <button className="text-button quest-details" onClick={() => open('guide')}>任务详情 <ArrowRight size={13} /></button>}
    </section>
    <div className="street-patrol-count"><span />附近游荡目标 {s.streetActive}/3<small>已制伏 {s.streetDefeated} · 自动补位</small></div>

    {s.combat && enemy && <section className="monster-status" aria-label="目标状态"><div><MonsterGlyph /><span><small>{enemy.enraged ? '暴怒 · 高危' : enemy.elite ? '精英夜 · 高额悬赏' : enemy.street ? '街区游荡 · 小额谢礼' : '城中祸害'}</small><strong>{enemy.name}</strong></span>{settings.enemyHealthBars && <b>{Math.ceil(enemy.health / enemy.maxHealth * 100)}<small>%</small></b>}</div>{settings.enemyHealthBars && <div className="monster-health"><i style={{ transform: `scaleX(${enemy.health / enemy.maxHealth})` }} /></div>}<p className={enemy.action === 'windup' ? 'danger' : ''}>{enemy.action === 'windup' ? '要冲撞了 —— 快侧身闪避！' : enemy.action === 'guard' ? '它正在格挡，用重击破防！' : enemy.action === 'recover' || enemy.action === 'stagger' ? '它露出破绽了，快出手！' : enemy.action === 'charge' ? '别站在它的冲刺线上。' : enemy.street ? '制伏后稍候会出现新目标' : s.locked ? '已锁定 · 贴身周旋' : '按 Q 锁定目标'}</p></section>}

    <div className="map-hud">
      <div className="map-heading"><Compass size={13} /><span>上海 · 动态夜巡</span><span className="map-region">{districtName(s.player.x, s.player.z)}</span></div>
      <button className="minimap-button" onClick={() => open('map')} aria-label="打开街区地图"><WorldMap snapshot={s} /><span className="map-expand"><MapTrifold size={12} /><Key>M</Key></span></button>
      <div className="map-caption"><span className="map-day-dot" />第 {String(s.progress.hunts + 1).padStart(2, '0')} 夜<span>21:{String(24 + Math.floor(s.time / 60) % 36).padStart(2, '0')}</span><span>夜巡中</span></div>
    </div>

    <div className="world-title"><div><span />上海 · {districtName(s.player.x, s.player.z)}<span /></div><h2>{s.combat ? '看清路数，沉着出手' : districtName(s.player.x, s.player.z)}</h2><p>{s.combat ? '稳住阵脚，看清它的路数。' : s.weather === '暴雨' ? '雨落申城，霓虹在积水里摇晃。' : s.weather === '雾霾' ? '雾漫街巷，跟紧身边的伙伴。' : '十里洋场夜色深，侠客独行守霓虹。'}</p></div>

    <section className="equipment-hud" aria-label="装备栏">
      <div className="weapon-label"><Sword size={21} weight="light" /><div><small>随身兵器</small><strong>{weaponName}</strong></div><span className="weapon-tier">{s.progress.weaponLevel ? `精修 ${s.progress.weaponLevel}` : '未精修'}</span></div>
      <div className="sharpness"><span /><span /><span /><span /><span /></div>
      <div className="quick-items">
        <button className="quick-item selected" {...actionHandlers('heal')} title="喝奶茶回血 (R)" aria-label={`喝奶茶，还剩 ${s.potions} 杯`}><span className="item-key">R</span><Flask size={27} weight="light" /><span className="quick-label">奶茶</span><span className="item-count">{s.potions}</span></button>
        <button className={`quick-item quick-pet ${s.petCooldown <= 0 ? 'selected' : ''}`} disabled={s.petCooldown > 0} {...actionHandlers('pet')} title={`${s.petSkillName} (C)`} aria-label={`${s.petSkillName}，${s.petCooldown > 0 ? `冷却 ${Math.ceil(s.petCooldown)} 秒` : '已就绪'}`}><span className="item-key">C</span><PawPrint size={27} weight="light" /><span className="quick-label">宠物</span><span className="item-count">{s.petCooldown > 0 ? Math.ceil(s.petCooldown) : s.progress.petLevel}</span></button>
        <button className={`quick-item ${s.locked ? 'selected' : ''}`} {...actionHandlers('lock')} title="锁定目标 (Q)" aria-label="锁定目标" aria-pressed={s.locked}><span className="item-key">Q</span><Crosshair size={27} weight="light" /><span className="quick-label">锁定</span></button>
        <button className="quick-item quick-forge" onClick={() => open('forge')} title="侠客强化 (F)" aria-label="打开强化所"><span className="item-key">F</span><Wrench size={26} weight="light" /><span className="quick-label">强化</span><span className="item-count">{s.progress.level}</span></button>
        <button className="quick-item quick-guide" onClick={() => open('guide')} title="夜巡手册 (G)" aria-label="打开夜巡手册"><span className="item-key">G</span><BookOpen size={26} weight="light" /><span className="quick-label">手册</span></button>
      </div>
      <div className="item-caption"><span>奶茶</span><small>回血续命</small></div>
    </section>

    <div className="bottom-controls"><span><Key>W A S D</Key>移动</span><span><Key>拖动</Key>环顾</span><span><Key><MouseLeftClick size={12} /></Key>攻击</span><span><Key>SPACE</Key>闪避</span><span><Key>E</Key>交互</span><button onClick={() => open('help')}><Key>H</Key>全部操作<ArrowRight size={12} /></button></div>
    <div className="camera-tools"><button onClick={() => engine?.resetCamera()} aria-label="镜头归位" title="镜头归位 (V)" disabled={paused}><Compass size={18} /><span>归位</span></button><small>拖动环顾 · 双指缩放</small></div>
    <span className="expedition-code">沪上夜巡 <i /> 001 — SH</span>

    {s.interact && <button className="interact-prompt" {...actionHandlers('interact')}><Key>E</Key><span><strong>{s.interact.label}</strong><small>{s.interact.detail}</small></span><CaretRight size={18} /></button>}

    {s.notifications.length > 0 && <div className="notifications" aria-live="polite">{s.notifications.slice(-2).map(n => <div className={`notice ${n.kind}`} key={n.id}><div className="notice-icon">{n.kind === 'success' ? <Check size={17} /> : n.kind === 'warning' ? <Skull size={17} /> : <Wind size={17} />}</div><div><strong>{n.title}</strong><p>{n.description}</p></div></div>)}</div>}
    {s.combo > 1 && s.combat && s.attacking && <div className="combo-indicator"><span>{s.combo}</span> 连击 <CircleNotch size={13} /></div>}
    {s.health / s.maxHealth < .3 && !s.dead && <div className="low-health" aria-hidden="true" />}
    <div className={`mobile-controls ${s.interact ? 'has-interact' : ''}`}>
      <TouchJoystick engine={engine} paused={paused} />
      <div className="touch-actions">
        {s.interact && <button className="touch-interact" {...actionHandlers('interact')} aria-label={`交互：${s.interact.label}`}><HandCoins size={20} /><span>交互</span></button>}
        <button {...actionHandlers('dodge')} aria-label="闪避"><Wind size={21} /><span>闪避</span></button>
        <button className="primary-action" {...actionHandlers('attack')} aria-label="攻击"><Sword size={26} /><span>攻击</span></button>
        <button {...actionHandlers('heavy')} aria-label="重击"><Crosshair size={20} /><span>重击</span></button>
      </div>
    </div>
  </div>;
}
