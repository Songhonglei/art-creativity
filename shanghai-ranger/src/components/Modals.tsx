import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, Check, Coins, Compass, Crosshair, Diamond, Feather, GearSix, Hammer, Heart, LockSimple, MapPin, MoonStars, PawPrint, Shield, SpeakerHigh, Star, Sword, TShirt, Umbrella, Wrench, Wind, CloudFog, CloudRain, WarningCircle, X } from '@phosphor-icons/react';
import { Emblem, MonsterGlyph, SkinArt, WeaponArt } from './Emblem';
import { Key } from './Hud';
import { WorldMap } from './WorldMap';
import { PETS, ROSTER, SKINS, WEAPONS, monsterBehavior, weaponUnlocked } from '../game/simulation';
import { districtName } from '../game/districts';
import type { Snapshot, Settings } from '../game/types';
import type { Engine } from '../game/engine';
import type { ModalName } from '../App';

type Props = { saveWarning?: ReactNode; modal: ModalName; s: Snapshot; engine: Engine | null; settings: Settings; setSettings: (s: Settings) => void; close: () => void; open: (m: ModalName) => void };

export function Modal({ modal, s, engine, settings, setSettings, close, open, saveWarning }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]');
      if (!list?.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap); return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [modal]);
  const titles = { map: '街区一览', guide: '夜巡手册', forge: '侠客强化所', settings: '夜巡设置', help: '夜行指南' };
  const labels = { map: '上海街区地图', guide: '街坊委托', forge: '强化所', settings: '夜巡设置', help: '侠客手册' };
  const icons = { map: Compass, guide: BookOpen, forge: Wrench, settings: GearSix, help: Sword }; const Icon = icons[modal];
  return <div className="modal-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
    <div className={`modal-panel modal-${modal}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={ref}>
      <div className="modal-header"><div><span className="eyebrow gold"><Icon size={14} />{labels[modal]}</span><h2 id="modal-title">{titles[modal]}</h2></div><button className="close-button" onClick={close} aria-label="关闭菜单"><X size={20} /><Key>ESC</Key></button></div>
      {saveWarning}
      {modal === 'map' && <MapContent s={s} engine={engine} close={close} />}
      {modal === 'guide' && <GuideContent s={s} />}
      {modal === 'forge' && <ForgeContent s={s} engine={engine} />}
      {modal === 'settings' && <SettingsContent settings={settings} setSettings={setSettings} open={open} engine={engine} s={s} />}
      {modal === 'help' && <HelpContent />}
      <div className="modal-footer"><span><span className="tiny-dot" />夜巡已暂停</span>{s.questPhase === 'complete' ? <button className="text-button" onClick={() => { engine?.reset(); close(); }}>下一轮夜巡 <ArrowRight size={13} /></button> : <span>上海 · 夜色街区 <Diamond size={8} /></span>}</div>
    </div>
  </div>;
}

function MapContent({ s, engine, close }: { s: Snapshot; engine: Engine | null; close: () => void }) {
  const clue = s.resources.find(r => r.kind === 'clue' && !r.collected);
  const clueDistance = clue ? Math.round(Math.hypot(clue.x - s.player.x, clue.z - s.player.z)) : 0;
  return <div className="map-content"><div className="map-canvas"><WorldMap snapshot={s} large /><span className="map-scale">0 ━━━━━ 50 米</span></div><aside className="map-info"><span className="eyebrow">上海 · {districtName(s.player.x, s.player.z)}</span><h3>{s.questDistrict}<br />夜巡委托</h3><p>金色虚线指向下一处调查点；收齐三条线索后才显示目标精确位置。地图随脚步延展，远处目标会在边缘指示方向。</p><div className="map-info-weather"><MoonStars size={22} /><span>{s.weather}<small>{s.monsterElite ? `精英夜 · 悬赏 ${s.questReward} 元` : `当前天象 · 悬赏 ${s.questReward} 元`}</small></span></div><div className="map-legend"><span><MapPin />你的位置</span><span><Diamond />{s.questPhase === 'tracking' ? `下一处线索 · ${clueDistance} 米` : s.targetRevealed ? `${s.monsterName} · ${Math.round(s.monsterDistance)} 米` : '目标尚未现身'}</span><span><CloudFog />奶茶补给</span><span><Crosshair />橙色为游荡目标</span><span><Shield />街坊求助与大排档</span></div><button className="primary-button" disabled={s.combat} onClick={() => { engine?.returnToCamp(); close(); }}><PawPrint size={17} />{s.combat ? '交战中无法返回' : '回大排档吃夜宵'}<ArrowRight size={15} /></button><small className="muted">在大排档坐下可回满气血与奶茶，并推进天象变化。</small></aside></div>;
}

function GuideContent({ s }: { s: Snapshot }) {
  const [tab, setTab] = useState<'quest' | 'monster' | 'story'>('quest');
  const entry = ROSTER[s.progress.hunts % ROSTER.length];
  const behavior = monsterBehavior(entry.kind);
  const behaviorTip = behavior === 'vehicle' ? '转向慢、冲撞远。把它引到建筑或街角，撞墙后会硬直 2.6 秒。'
    : behavior === 'bruiser' ? '近身缠斗且会格挡。普攻会被大幅减伤，保留体力用重击破防。'
      : behavior === 'elite' ? '前摇短、收势快，低血量更早暴怒。不要盲目连击，配合宠物技寻找窗口。'
        : '转向灵活、扑击频繁。保持侧面移动，短前摇后立刻闪避。';
  return <><div className="panel-tabs"><button className={tab === 'quest' ? 'active' : ''} onClick={() => setTab('quest')}>当前委托</button><button className={tab === 'monster' ? 'active' : ''} onClick={() => setTab('monster')}>祸害档案</button><button className={tab === 'story' ? 'active' : ''} onClick={() => setTab('story')}>夜巡手记</button></div>
    {tab === 'quest' && <div className="guide-content"><div className="guide-plate"><Emblem /><span>街坊委托</span><span className="plate-number">001</span><div className="plate-stars"><Star weight="fill" /><Star weight="fill" /><Star /></div></div><div className="guide-copy"><span className="eyebrow gold">上海夜巡 · {s.questDistrict}{s.monsterElite ? ' · 精英夜' : ''}</span><h3>夜色巡逻</h3><p>夜色里总有些讨厌东西出来祸害街坊：翻包的野猫、乱扑的野狗、无牌电驴、炸街鬼火、地痞流氓……循着痕迹找到它们，统统制伏。</p><blockquote>“这座城市不缺英雄，缺的是愿意多管闲事的人。”<cite>—— 大排档老板娘</cite></blockquote><div className="assignment-list"><div><span className={s.tracked === 3 ? 'complete' : ''}>{s.tracked === 3 ? <Check /> : '01'}</span><section><strong>读懂街区</strong><p>跟着金色光点走，在可疑痕迹旁按 E 收集线索。</p></section></div><div><span className={s.monsterHealth === 0 ? 'complete' : ''}>{s.monsterHealth === 0 ? <Check /> : '02'}</span><section><strong>制伏祸害</strong><p>看清前摇侧身闪避，等它收势的间隙再用重击狠砸。</p></section></div><div><span className={s.questPhase === 'complete' ? 'complete' : ''}>{s.questPhase === 'complete' ? <Check /> : '03'}</span><section><strong>收缴赃物</strong><p>按 E 收缴零件与悬赏现金，拿到强化所升级装备。</p></section></div></div><div className="quest-reward"><Coins size={18} /><span>{s.questReward} 元现金</span><span className="muted">{s.monsterElite ? '精英悬赏' : '基础悬赏'}</span><Diamond size={16} /><span>{s.monsterElite ? 6 : 4} 五金零件</span></div></div></div>}
    {tab === 'monster' && <div className="guide-content"><div className="guide-plate monster-plate"><MonsterGlyph /><span>本轮目标</span><span className="plate-number">{entry.name}</span><div className="plate-stars"><Star weight="fill" /><Star weight="fill" /><Star /></div></div><div className="guide-copy"><span className="eyebrow gold">城中祸害 · {entry.title}</span><h3>今晚它也在作恶</h3><p>每制伏一个祸害，下一个夜晚就会冒出更难缠的角色。今晚轮到它——别留情面。</p><div className="bestiary-facts"><div><strong>辨认路数</strong><p>{behaviorTip}</p></div><div><strong>抓住破绽</strong><p>冲撞后它需要收势，这期间你的伤害提高 30%。</p></div><div><strong>小心暴怒</strong><p>血量低于 40% 它会暴怒加速；在它收势时给一记重击可以将其打懵。</p></div></div><div className="material-drops"><span><Diamond />五金零件</span><span><Coins />悬赏现金</span></div></div></div>}
    {tab === 'story' && <div className="story-content"><span className="eyebrow gold">夜巡手记 · 第一章</span><h3>霓虹之下，<br />总有人要站出来。</h3><p>你是「夜鹰」，沪上的都市侠客。白天你是普通街坊，夜里披上连帽风衣、戴好口罩，拎着战术棍与长柄伞走进梧桐与霓虹之间。</p><p>你身边跟着一只捡来的江湖宠物，身后是城隍庙大排档为你留的一碗热馄饨。哪儿有祸害，哪儿就有你的身影。</p><div className="story-seasons"><div><MoonStars /><h4>晴夜</h4><p>月色正好，奶茶摊出摊，体力充沛。</p></div><div><CloudFog /><h4>雾霾</h4><p>雾气沉沉，体力恢复变慢。</p></div><div><CloudRain /><h4>暴雨</h4><p>雨夜路滑，祸害动作更快。</p></div></div><p className="story-note">每轮夜巡会前往不同风貌街区，每四夜出现一次高额精英委托。制伏祸害、帮助街坊，用零件强化自己，明天晚上接着巡。</p></div>}
  </>;
}

function ForgeContent({ s, engine }: { s: Snapshot; engine: Engine | null }) {
  const [tab, setTab] = useState<'weapons' | 'training' | 'skins'>('weapons');
  const level = s.progress.level;
  const max = level >= 5, cost = { parts: 3 + level, cash: level * 400 };
  const canLevel = !max && s.progress.parts >= cost.parts && s.progress.cash >= cost.cash;
  return <><div className="forge-toolbar"><div className="panel-tabs"><button className={tab === 'weapons' ? 'active' : ''} onClick={() => setTab('weapons')}><Wrench size={16} />城市兵器</button><button className={tab === 'training' ? 'active' : ''} onClick={() => setTab('training')}><PawPrint size={16} />宠物与精修</button><button className={tab === 'skins' ? 'active' : ''} onClick={() => setTab('skins')}><TShirt size={16} />侠客衣橱</button></div><span><Coins size={16} />{s.progress.cash.toLocaleString()} <small>元现金</small></span></div>
    {tab === 'weapons' ? <div className="forge-content"><div className="forge-preview"><div className="forge-art"><span className="forge-circle" /><WeaponArt type={s.progress.weapon} /><span className="preview-label">侠义 {String(level).padStart(2, '0')} 级</span></div><div className="weapon-choices">{WEAPONS.map(w => {
      const unlocked = weaponUnlocked(w.id, level);
      return <button key={w.id} disabled={s.combat || !unlocked} className={`${s.progress.weapon === w.id ? 'active' : ''} ${!unlocked ? 'locked' : ''}`} onClick={() => { engine?.simulation.equip(w.id); engine?.publish(); }}>
        {w.id === 'crowbar' ? <Hammer size={21} /> : w.id === 'umbrella' ? <Umbrella size={21} /> : <Sword size={21} />}<span>{w.name}<small>{unlocked ? w.desc : `侠义 ${w.unlockLevel} 级解锁`}</small></span>{s.progress.weapon === w.id ? <Check size={15} /> : !unlocked && <LockSimple size={15} />}
      </button>;
    })}</div></div>
      <div className="forge-details"><span className="eyebrow gold">城市装备 · 攻防一体</span><h3>{WEAPONS.find(w => w.id === s.progress.weapon)?.name} · 精修 {s.progress.weaponLevel}/3</h3><p>碳纤维战术棍沉稳重击，钛合金伸缩棍快速连击，长柄战术伞攻守均衡。提升侠义等级，攻击与气血同时成长。</p><div className="forge-stat"><span>攻击力</span><strong>{engine?.simulation.attackDamage}</strong><ArrowRight size={19} /><b>{engine ? engine.simulation.attackDamage + (max ? 0 : 13) : 57}</b></div><div className="forge-stat"><span>气血上限</span><strong>{s.maxHealth}</strong><ArrowRight size={19} /><b>{s.maxHealth + (max ? 0 : 18)}</b></div><div className="materials-heading"><span>所需材料</span><span>持有 / 需要</span></div><div className="materials-list"><div><Diamond size={18} /><span>五金零件</span><b className={s.progress.parts >= cost.parts ? 'enough' : ''}>{s.progress.parts} <small>/ {cost.parts}</small></b>{s.progress.parts >= cost.parts ? <Check size={13} /> : <span className="empty-check" />}</div><div><Coins size={18} /><span>现金</span><b className={s.progress.cash >= cost.cash ? 'enough' : ''}>{s.progress.cash.toLocaleString()} <small>/ {cost.cash.toLocaleString()}</small></b>{s.progress.cash >= cost.cash ? <Check size={13} /> : <span className="empty-check" />}</div></div><button className="primary-button forge-button" disabled={!canLevel} onClick={() => { engine?.simulation.levelUp(); engine?.publish(); }}><Wrench size={18} />{max ? '已满级' : canLevel ? '提升侠义等级' : '材料不足'}<span>{max ? '' : `${cost.cash} 元`}</span></button><small className="muted">{max ? '你已是可以独当一面的大侠。' : canLevel ? '强化消耗材料，进度自动存档。' : '制伏祸害、翻找零件堆来攒材料。'}</small>{s.combat && <small className="forge-combat-note">交战中无法更换兵器。</small>}</div></div>
      : tab === 'training' ? <TrainingContent s={s} engine={engine} />
      : <div className="wardrobe-content"><div className="wardrobe-heading"><span className="eyebrow gold">三套完整造型 · 随时切换</span><h3>今夜，穿哪一身巡城？</h3><p>每套都有独立配色、披风纹样和角色构件。选择立即生效，并写入本地存档。</p></div><div className="skin-grid">{SKINS.map(skin => <button key={skin.id} className={`skin-card skin-${skin.id} ${s.progress.skin === skin.id ? 'active' : ''}`} aria-pressed={s.progress.skin === skin.id} aria-label={`切换皮肤${skin.name}`} onClick={() => engine?.setSkin(skin.id)}><div className="skin-art-wrap"><SkinArt type={skin.id} />{s.progress.skin === skin.id && <span className="skin-equipped"><Check size={13} />已穿着</span>}</div><span className="skin-copy"><strong>{skin.name}</strong><small>{skin.desc}</small><span className="skin-swatches">{skin.palette.map(color => <i key={color} style={{ background: color }} />)}</span></span></button>)}</div><p className="wardrobe-note"><TShirt size={15} />外观不影响攻击与气血，可搭配任意城市兵器和江湖宠物。</p></div>}
  </>;
}

function TrainingContent({ s, engine }: { s: Snapshot; engine: Engine | null }) {
  const pet = PETS.find(p => p.id === s.progress.pet)!;
  const petCost = { parts: s.progress.petLevel * 3, cash: s.progress.petLevel * 500 };
  const weaponCost = { parts: 4 + s.progress.weaponLevel * 3, cash: 600 + s.progress.weaponLevel * 500 };
  const canPet = s.progress.petLevel < 3 && s.progress.parts >= petCost.parts && s.progress.cash >= petCost.cash;
  const canWeapon = s.progress.weaponLevel < 3 && s.progress.parts >= weaponCost.parts && s.progress.cash >= weaponCost.cash;
  const passive = s.progress.pet === 'orangeCat' ? `常驻减伤 ${s.progress.petLevel * 3} 点` : s.progress.pet === 'corgi' ? `体力恢复 +${s.progress.petLevel * 3}/秒` : '主动指出最近线索或目标方位';
  return <div className="training-content"><div className="training-heading"><span className="eyebrow gold">陪伴与手艺 · 都会真正改变战斗</span><h3>把悬赏花在刀刃上。</h3><p>宠物训练强化主动技与被动能力；兵器精修提升全部城市兵器的伤害。消耗零件和现金，立即生效并自动存档。</p></div><div className="training-grid"><section className="training-card"><div className={`pet-face pet-${s.progress.pet}`} /><span className="eyebrow">{pet.name} · 训练 {s.progress.petLevel}/3</span><h4>{pet.skill}</h4><p>{passive}。主动技冷却随训练缩短，按 C 或点击宠物技能按钮释放。</p><div className="training-cost"><span><Diamond />{petCost.parts} 零件</span><span><Coins />{petCost.cash} 元</span></div><button className="primary-button" disabled={!canPet} onClick={() => { engine?.simulation.trainPet(); engine?.publish(); }}><PawPrint size={17} />{s.progress.petLevel >= 3 ? '训练已满级' : canPet ? '训练宠物' : '材料不足'}</button></section><section className="training-card"><Sword size={34} weight="light" /><span className="eyebrow">全部兵器 · 精修 {s.progress.weaponLevel}/3</span><h4>每级攻击伤害 +5</h4><p>当前精修加成 +{s.progress.weaponLevel * 5}。更换碳纤维战术棍、伸缩棍或战术伞后仍然保留。</p><div className="training-cost"><span><Diamond />{weaponCost.parts} 零件</span><span><Coins />{weaponCost.cash} 元</span></div><button className="primary-button" disabled={!canWeapon} onClick={() => { engine?.simulation.refineWeapon(); engine?.publish(); }}><Hammer size={17} />{s.progress.weaponLevel >= 3 ? '精修已满级' : canWeapon ? '精修兵器' : '材料不足'}</button></section></div><p className="training-note">持有 {s.progress.parts} 零件 · {s.progress.cash.toLocaleString()} 元现金。除了夜巡悬赏，帮助街坊和翻找零件堆也能积攒材料。</p></div>;
}

function SettingsContent({ settings, setSettings, open, engine, s }: { settings: Settings; setSettings: (s: Settings) => void; open: (m: ModalName) => void; engine: Engine | null; s: Snapshot }) {
  const soundscapes = [
    { id: 'neon', name: '电子夜脉', detail: '霓虹合成器' },
    { id: 'jazz', name: '梧桐爵士', detail: '摇摆和弦' },
    { id: 'river', name: '江畔氛围', detail: '水岸空灵' },
    { id: 'radio', name: '老城电台', detail: '复古旋律' },
  ] as const;
  return <div className="settings-content"><div className="settings-row"><div><SpeakerHigh size={21} /><span><strong>城市之声</strong><small>雨声、风声与战斗音效。</small></span></div><button className={`toggle ${settings.sound ? 'on' : ''}`} role="switch" aria-checked={settings.sound} aria-label="游戏声音" onClick={() => { engine?.audio.unlock(); setSettings({ ...settings, sound: !settings.sound }); }}><span /></button></div><label className="settings-row"><div><span><strong>主音量</strong><small>{Math.round(settings.volume * 100)}%</small></span></div><input aria-label="主音量" type="range" min="0" max="1" step=".05" value={settings.volume} onChange={e => setSettings({ ...settings, volume: Number(e.target.value) })} /></label><div className="settings-row soundscape-row"><div><SpeakerHigh size={21} /><span><strong>城市声景</strong><small>{settings.sound ? '切换即播放。' : '声音已关闭，开启后播放所选声景。'}</small></span></div><div className="soundscape-picker">{soundscapes.map(item => <button key={item.id} className={settings.soundscape === item.id ? 'active' : ''} aria-pressed={settings.soundscape === item.id} onClick={() => { engine?.audio.setSoundscape(item.id); engine?.audio.unlock(); setSettings({ ...settings, soundscape: item.id }); }}><strong>{item.name}</strong><small>{item.detail}</small></button>)}</div></div><div className="settings-row"><div><Compass size={21} /><span><strong>画质</strong><small>根据设备性能选择。</small></span></div><div className="segmented"><button className={settings.quality === 'low' ? 'active' : ''} onClick={() => setSettings({ ...settings, quality: 'low' })}>流畅</button><button className={settings.quality === 'balanced' ? 'active' : ''} onClick={() => setSettings({ ...settings, quality: 'balanced' })}>均衡</button><button className={settings.quality === 'high' ? 'active' : ''} onClick={() => setSettings({ ...settings, quality: 'high' })}>高</button></div></div><label className="settings-row"><div><span><strong>镜头灵敏度</strong><small>{settings.sensitivity.toFixed(1)}× · 拖动环顾</small></span></div><input aria-label="镜头灵敏度" type="range" min=".3" max="2" step=".1" value={settings.sensitivity} onChange={e => setSettings({ ...settings, sensitivity: Number(e.target.value) })} /></label><div className="settings-row"><div><Wind size={21} /><span><strong>稳定镜头</strong><small>减少战斗中的镜头晃动。</small></span></div><button className={`toggle ${settings.reducedMotion ? 'on' : ''}`} role="switch" aria-checked={settings.reducedMotion} aria-label="稳定镜头" onClick={() => setSettings({ ...settings, reducedMotion: !settings.reducedMotion })}><span /></button></div>
    <div className="settings-row"><div><Crosshair size={21} /><span><strong>怪物血条</strong><small>显示附近目标的头顶血条与战斗血量。</small></span></div><button className={`toggle ${settings.enemyHealthBars ? 'on' : ''}`} role="switch" aria-checked={settings.enemyHealthBars} aria-label="怪物血条" onClick={() => setSettings({ ...settings, enemyHealthBars: !settings.enemyHealthBars })}><span /></button></div>
    <div className="settings-row pet-row"><div><PawPrint size={21} /><span><strong>江湖宠物</strong><small>它会一路跟着你巡逻。</small></span></div><div className="pet-picker">{PETS.map(p => <button key={p.id} className={s.progress.pet === p.id ? 'active' : ''} onClick={() => { engine?.setPet(p.id); }} aria-label={`选择宠物${p.name}`}><span className={`pet-face pet-${p.id}`} /><span>{p.name}</span></button>)}</div></div>
    <button className="settings-help" onClick={() => open('help')}><span><strong>需要温习操作？</strong><small>打开夜行指南看看键位。</small></span><ArrowRight size={17} /></button>
    <p className="local-save-note"><Heart size={13} />进度仅保存在本机浏览器，不会跨设备同步。</p></div>;
}

function HelpContent() {
  const controls: [string, string][] = [['W A S D', '在街区里移动'], ['SHIFT', '疾跑 · 消耗体力'], ['拖动', '围绕角色环顾与俯仰'], ['滚轮', '调整镜头距离'], ['V', '镜头归位到角色身后'], ['点击 / J', '攻击 · 可三连'], ['右键 / K', '重击 · 耗体力更多伤害更高'], ['空格', '向左后或右后闪避 · 短暂无敌'], ['Q', '锁定目标'], ['E', '查看 / 拿取 / 制伏 / 坐下'], ['R / 1', '喝杯奶茶回血'], ['C', '释放宠物主动技'], ['M', '打开街区地图'], ['F / G', '强化所 / 夜巡手册']];
  return <div className="help-content"><div className="help-intro"><Emblem /><div><h3>看清路数，再出手。</h3><p>跟着金色光点找线索。读懂祸害的动作，抓住收势的间隙一击制胜。</p></div></div><div className="controls-grid">{controls.map(([key, label]) => <div key={key}><Key>{key}</Key><span>{label}</span></div>)}</div><div className="help-tip"><Heart size={19} /><p><strong>耐心是侠客的老朋友。</strong> 停下攻击和疾跑，体力就会恢复。闪过冲撞，等它收势时再用重击狠狠招呼。</p></div><p className="muted">手机左手摇杆移动，右手拖动空白场景环顾；双指在场景中张合缩放，右下按钮出招。锁定时可手动环顾，松手稍候跟回目标。打开菜单会暂停夜巡。</p></div>;
}

export function ResultOverlay({ s, retry, forge, continueHunt, saveWarning }: { saveWarning?: ReactNode; s: Snapshot; retry: () => void; forge: () => void; continueHunt: () => void }) {
  const dead = s.dead;
  const completedHunt = Math.max(0, s.progress.hunts - 1);
  const completedElite = completedHunt > 0 && (completedHunt + 1) % 4 === 0 || ROSTER[completedHunt % ROSTER.length].kind === 'official';
  const completedCash = Math.round((800 + completedHunt * 100) * (completedElite ? 1.5 : 1));
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    resultRef.current?.querySelector('button')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const buttons = resultRef.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
    };
    document.addEventListener('keydown', trap); return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, []);
  return <div className="result-backdrop"><section ref={resultRef} className={`result-panel ${dead ? 'defeat' : ''}`} role="dialog" aria-modal="true" aria-labelledby="result-title"><div className="result-crest">{dead ? <Feather size={48} weight="light" /> : <Star size={48} weight="light" />}</div><span className="eyebrow gold">{dead ? '侠客也会跌倒' : '本轮夜巡完成'}</span><h2 id="result-title">{dead ? '街区还在等你。' : '街坊们睡了个好觉。'}</h2><p>{dead ? '你的宠物把你拖回了大排档。装备和零件都还在，吃碗馄饨，研究清楚它的路数再来。' : '祸害被制伏，霓虹依旧明亮。用这笔悬赏和零件，把自己磨炼得更强。'}</p>{!dead && <><div className="result-rewards"><div><Diamond size={24} /><strong>{completedElite ? 6 : 4}</strong><span>五金零件</span></div><div><Coins size={24} /><strong>{completedCash}</strong><span>{completedElite ? '精英悬赏现金' : '悬赏现金'}</span></div><div><Shield size={24} /><strong>LV.{s.progress.level}</strong><span>侠义等级</span></div></div><div className="result-meta"><span>第 {String(s.progress.hunts + 1).padStart(2, '0')} 夜</span><span>下一位祸害已冒头</span><span className={s.saveStatus === 'saved' ? '' : 'save-failed'}>{s.saveStatus === 'saved' ? <Check size={12} /> : <WarningCircle size={12} />}{s.saveStatus === 'saved' ? '进度已存档' : '进度未保存'}</span></div></>}{saveWarning}<div className="result-actions"><button className="primary-button" onClick={dead ? retry : forge}>{dead ? <Wind size={18} /> : <Wrench size={18} />}{dead ? '重返街区' : '去强化所'}<ArrowRight size={17} /></button>{!dead && <button className="secondary-button" onClick={retry}>下一轮夜巡<ArrowRight size={16} /></button>}</div>{!dead && <button className="text-button" onClick={continueHunt}>在街区里再逛逛</button>}<div className="result-line"><span /><Diamond size={9} /><span /></div></section></div>;
}
