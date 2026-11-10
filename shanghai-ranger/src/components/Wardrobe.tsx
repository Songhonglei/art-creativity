import { useState } from 'react';
import { ArrowRight, Check, LockSimple, TShirt } from '@phosphor-icons/react';
import { SKINS, skinUnlocked } from '../game/heroProgress';
import { HeroPreview } from './HeroPreview';
import type { Engine } from '../game/engine';
import type { Settings, Snapshot } from '../game/types';

export function Wardrobe({ s, engine, settings, upgrade }: { s: Snapshot; engine: Engine | null; settings: Settings; upgrade: () => void }) {
  const [selected, setSelected] = useState(s.progress.skin);
  const definition = SKINS.find(skin => skin.id === selected)!, unlocked = skinUnlocked(selected, s.progress.level), equipped = selected === s.progress.skin;
  const restricted = !engine?.simulation.canChangeAppearance;
  return <div className="wardrobe-v1">
    <HeroPreview skin={selected} gender={s.progress.gender} weapon={s.progress.weapon} reducedMotion={settings.reducedMotion}/>
    <section className="wardrobe-selection"><div className="wardrobe-heading"><span className="eyebrow gold">侠客衣橱 · 侠义 {s.progress.level} 级</span><h3>{definition.name}</h3><p>{definition.desc}</p></div>
      <div className="skin-choices" aria-label="试穿皮肤">{SKINS.map(skin => <button key={skin.id} className={`outfit-choice ${selected === skin.id ? 'active' : ''}`} aria-pressed={selected === skin.id} aria-label={`试穿${skin.name}`} onClick={() => setSelected(skin.id)}>
        <span className="outfit-color" style={{ background: skin.palette[0], borderColor: skin.palette[2], color: skin.palette[1] }}><img src={`./assets/hero/outfit-${skin.id}-${s.progress.gender ?? 'male'}.png`} alt={skin.name} draggable={false}/></span><span><strong>{skin.name}</strong><small>{skin.id === s.progress.skin ? '当前穿戴' : skinUnlocked(skin.id, s.progress.level) ? '已解锁' : `侠义 ${skin.level} 级解锁`}</small></span>{skin.id === s.progress.skin ? <Check size={18}/> : !skinUnlocked(skin.id, s.progress.level) ? <LockSimple size={16}/> : null}
      </button>)}</div>
      <div className="wardrobe-equip"><button className="primary-button" disabled={equipped || !unlocked || restricted} onClick={() => engine?.setSkin(selected)}><TShirt size={19}/>{equipped ? '当前穿戴' : !unlocked ? `侠义 ${definition.level} 级解锁` : restricted ? '暂时不能换装' : '穿戴'}</button>
        {!unlocked && <button className="text-button" onClick={upgrade}>提升侠义等级<ArrowRight size={16}/></button>}
        <p role="status">{restricted ? s.dead || s.rescueTime > 0 || s.recoveryProtection > 0 ? '恢复结束后可换装。' : '交战或出招时不能换装。' : equipped ? s.saveStatus === 'saving' ? '外观正在保存…' : s.saveStatus === 'failed' ? '外观未保存，请重试保存。' : s.saveStatus === 'saved' ? '外观已保存。' : '当前外观。' : '试穿不保存，穿戴后自动存档。'}</p>
      </div>
    </section>
  </div>;
}
