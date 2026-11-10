import { useRef, useState } from 'react';
import { ArrowRight, Check, LockSimple, Plus, Shield, Sparkle } from '@phosphor-icons/react';
import type { Engine } from '../game/engine';
import type { Pet, PetAttribute, Snapshot } from '../game/types';
import { availablePoints, PETS, PET_NAMES, PET_SKINS, PET_XP, PET_MILESTONES, petSkin, petStats } from '../game/pets';
import { PetPreview } from './PetPreview';
const percent=(n:number)=>`${+(n*100).toFixed(1)}%`;
const decimal=(n:number)=>`${+n.toFixed(1)}`;

export function PetContent({s,engine}:{s:Snapshot;engine:Engine|null}) {
  const appearance=useRef<HTMLElement>(null);
  const [selected,setSelected]=useState<Pet>(s.progress.pet),[showSkins,setShowSkins]=useState(false);
  const g=s.progress.pets[selected], stats=petStats(selected,g), pet=PETS.find(p=>p.id===selected)!, skin=petSkin(selected,g.skin), points=availablePoints(g);
  const busy=s.combat||s.dead||s.rescueTime>0||s.attacking||s.dodging;
  const mutate=(action:()=>unknown)=>{action();engine?.publish();};
  const nextSkin=PET_SKINS[selected].find(skin=>skin.level>g.level);
  const row=(key:PetAttribute,label:string,current:string,next:string)=> <div className="pet-attribute" key={key}><div><strong>{label}</strong><small>{g.attributes[key]}/5</small></div><span>{current}<ArrowRight size={13}/><b>{g.attributes[key]>=5?'已满':next}</b></span><button aria-label={`${PET_NAMES[selected]}增加${label}`} disabled={busy||points<=0||g.attributes[key]>=5} onClick={()=>mutate(()=>engine?.simulation.allocatePet(selected,key))}><Plus size={18}/></button></div>;
  const skillEffects=selected==='orangeCat'?[`回血 ${percent(stats.heal)}`,`常驻减伤 ${stats.guard} 点`,...(g.level>=3?[`溢出护盾上限 ${percent(stats.shield)}`]:[])]:selected==='corgi'?[`恢复体力 ${stats.stamina}`,`常驻回体 +${decimal(stats.regen)}/秒`,...(g.level>=3?[`减耗 ${percent(stats.economy)} · ${stats.economyDuration} 秒`]:[])]:[`识破增伤 ${percent(stats.weakness)}`,`发现范围 ${decimal(stats.range)} 米`,`标记 ${stats.markDuration} 秒`];
  const nextSpecialty=petStats(selected,{...g,attributes:{...g.attributes,specialty:Math.min(5,g.attributes.specialty+1)}});
  const latest=PET_MILESTONES[selected].filter(([level])=>level<=g.level).slice(-1)[0];
  return <div className="pet-content">
    <div className="pet-roster">{PETS.map(p=><div key={p.id} className={`pet-roster-card ${selected===p.id?'selected':''}`}>
      <button className="pet-inspect" aria-label={`查看${PET_NAMES[p.id]}`} aria-pressed={selected===p.id} onClick={()=>setSelected(p.id)}><span className={`pet-face pet-${p.id}`}/><strong>{PET_NAMES[p.id]}</strong><span>{p.name} · {p.role}</span><small>Lv.{s.progress.pets[p.id].level}</small></button>
      <button className="pet-deploy" aria-label={s.progress.pet===p.id?`${PET_NAMES[p.id]}出战中`:`出战${PET_NAMES[p.id]}`} disabled={busy||s.progress.pet===p.id} onClick={()=>{engine?.setPet(p.id);setSelected(p.id);}}>{s.progress.pet===p.id?<><Check size={13}/>出战中</>:<>出战<ArrowRight size={13}/></>}</button>
    </div>)}</div>
    {busy&&<p className="pet-busy" role="status">{s.dead?'回大排档后可调整':s.combat?'脱战后可调整':'动作结束后可调整'}</p>}
    <div className="pet-workbench"><section className="pet-growth"><div className="pet-save-status" role="status">{s.saveStatus==='saved'?'已保存':s.saveStatus==='saving'?'正在保存':s.saveStatus==='failed'?'未保存，请重试':'修改后自动保存'}</div><div className="pet-growth-heading"><div><span>{pet.name} · {pet.role}</span><h3>{PET_NAMES[selected]} <small>Lv.{g.level}</small></h3></div><button className="pet-growth-skins" aria-controls="pet-appearance" onClick={()=>{setShowSkins(true);requestAnimationFrame(()=>{const target=appearance.current,panel=target?.closest('.modal-panel');if(target&&panel)panel.scrollTop+=target.getBoundingClientRect().top-panel.getBoundingClientRect().top-110;});}}>换肤<ArrowRight size={14}/></button></div>
      <div className="pet-xp-label"><span>{g.level===10?'已满级':`距 ${g.level+1} 级`}</span><b>{g.level===10?'Lv.10':`${g.xp} / ${PET_XP[g.level-1]}`}</b></div><div className="pet-xp" role="progressbar" aria-label={`${PET_NAMES[selected]}升级经验`} aria-valuenow={g.level===10?1:g.xp} aria-valuemin={0} aria-valuemax={g.level===10?1:PET_XP[g.level-1]}><i style={{transform:`scaleX(${g.level===10?1:g.xp/PET_XP[g.level-1]})`}}/></div>
      <div className="pet-skill-summary"><strong>{selected==='shiba'?'寻踪／识破':pet.skill}<small>基础冷却 {decimal(stats.cooldown)} 秒</small></strong><div>{skillEffects.map(effect=><span key={effect}>{effect}</span>)}</div><p>{latest[1]}</p></div>
      <div className="pet-points-toolbar"><strong>待分配 <b>{points}</b> 点</strong><button disabled={busy||points===0} onClick={()=>mutate(()=>engine?.simulation.recommendPet(selected))}><Sparkle size={15}/>推荐分配</button><button disabled={busy||points===g.level-1} onClick={()=>mutate(()=>engine?.simulation.resetPetAttributes(selected))}>重置</button></div>
      {row('guard','守护',`救援回血 ${percent(stats.rescue)}`,percent(stats.rescue+.02))}
      {row('vigor','活力',`冷却 ${decimal(stats.cooldown)} 秒`,`${decimal(Math.max(12,stats.cooldown-.6))} 秒`)}
      {row('specialty','专长',selected==='orangeCat'?`回血 ${percent(stats.heal)}`:selected==='corgi'?`回体 ${stats.stamina}`:`增伤 ${percent(stats.weakness)}`,selected==='orangeCat'?percent(nextSpecialty.heal):selected==='corgi'?`${nextSpecialty.stamina}`:percent(nextSpecialty.weakness))}
      {selected==='shiba'&&<div className="pet-range-row"><span>专长 · 发现范围</span><b>{decimal(stats.range)} 米{g.attributes.specialty<5&&` → ${decimal(nextSpecialty.range)} 米`}</b></div>}
      <small className="pet-reset-note">脱战免费调整；不会补充状态或刷新技能。</small>
      <div className="pet-traits"><strong>特性 <small>{g.level<5?'5 级解锁':'二选一，可免费更换'}</small></strong><div>{pet.traits.map((trait,i)=><button key={trait} aria-pressed={g.trait===(i?'second':'first')} disabled={busy||g.level<5} className={g.trait===(i?'second':'first')?'active':''} onClick={()=>mutate(()=>engine?.simulation.setPetTrait(selected,i?'second':'first'))}><span>{trait}{g.trait===(i?'second':'first')&&<Check size={13}/>}</span><small>{pet.traitDescriptions[i]}</small></button>)}</div></div>
    </section><section className="pet-appearance" ref={appearance} id="pet-appearance"><PetPreview pet={selected} skin={g.skin}/><div className="pet-skin-caption"><div><strong>{skin.name}</strong><small>{skin.desc}</small></div><button className="secondary-button" aria-expanded={showSkins} onClick={()=>setShowSkins(v=>!v)}>{showSkins?'收起':'换肤'}</button></div>
      {showSkins&&<div className="pet-skin-grid">{PET_SKINS[selected].map(outfit=>{const locked=g.level<outfit.level,equipped=g.skin===outfit.id;return <button key={outfit.id} aria-label={`${PET_NAMES[selected]}穿戴${outfit.name}`} aria-pressed={equipped} disabled={locked||busy} className={`pet-outfit ${equipped?'equipped':''}`} onClick={()=>engine?.setPetSkin(selected,outfit.id)}><span className="pet-outfit-colors">{outfit.colors.map((color,i)=><i key={i} style={{background:color}}/>)}</span><strong>{outfit.name}</strong><small>{outfit.desc}</small><span>{locked?<><LockSimple size={13}/>{outfit.level} 级解锁</>:equipped?<><Check size={13}/>使用中</>:'穿戴'}</span></button>;})}</div>}
      <p className="pet-skin-next">{nextSkin?`${nextSkin.level} 级解锁「${nextSkin.name}」`:'等级皮肤已全部解锁'}<small>皮肤只改变外观</small></p>
    </section>
    </div>
    <div className="pet-rescue-summary"><Shield size={20}/><div><strong>本轮救援：{s.rescueAvailable?'可用 1 次':s.rescueTime>0?'正在救援':'已用完'}</strong><p>致命伤后自动救起；用完后再倒下可回大排档，保留调查进度。回营休息后补充。</p></div></div>
    <details className="pet-rules"><summary>成长与能力说明</summary><p>调查 +8、街坊求助 +10、游荡制伏 +5、主目标制伏 +20、完成委托 +60 经验；出战获得完整经验，待命获得一半。升级自动生效，属性点可留待以后分配。</p><ul>{PET_MILESTONES[selected].map(([level,desc])=><li key={level}><span>Lv.{level}</span>{desc}{g.level>=level&&<Check size={13}/>}</li>)}</ul><p>晴夜宠物技能恢复较快。C／手机技能始终只需按一次，正常轻击或重击均可使用柴犬识破；不要求特殊连招。主动技能与自动辅助分别计时，切宠不会刷新。</p></details>
  </div>;
}
