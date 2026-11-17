import type { Skin } from './types';

export const HERO_MAX_LEVEL = 10;
export const combatLevel = (level: number) => Math.min(5, Math.max(1, level));
export const heroUpgradeCost = (level: number) => ({ parts: 3 + level, cash: level * 400 });
export const SKINS: { id: Skin; name: string; desc: string; level: number; palette: string[] }[] = [
  { id: 'nightwatch', name: '夜鹰巡衣', desc: '藏青风衣 · 折叠兜帽与夜鹰铜章', level: 1, palette: ['#28475f', '#3f8d91', '#bd8d4e'] },
  { id: 'magnolia', name: '白玉兰礼装', desc: '月白长衣 · 酒红马甲与玉兰胸针', level: 1, palette: ['#d8d2bd', '#8f3648', '#d2ac59'] },
  { id: 'neon', name: '霓虹行者', desc: '紫黑机能服 · 分体薄镜与短披肩', level: 1, palette: ['#29263e', '#3fe2dc', '#784dba'] },
  { id: 'wutong-warden', name: '梧桐巡守', desc: '墨绿短肩披 · 叶脉纹与巡城腰具', level: 4, palette: ['#214b48', '#243c50', '#bd985f'] },
  { id: 'riverside-sentinel', name: '江畔司夜', desc: '双层肩披 · 湖绿长衣与怀表链', level: 7, palette: ['#203a56', '#377b7d', '#d6c5a1'] },
  { id: 'shanghai-paragon', name: '申城守望', desc: '层叠肩护 · 玉兰胸针与精装长披', level: 10, palette: ['#172d40', '#e7ddc7', '#cfab66'] },
];
export function skinUnlocked(id: unknown, level: number): id is Skin {
  return SKINS.some(skin => skin.id === id && level >= skin.level);
}
export function heroUpgradeReward(level: number) {
  const skin = SKINS.find(s => s.level === level && level > 1);
  return [level <= 5 ? '攻击 +13，气血 +18' : '', skin ? `已解锁：${skin.name}` : level === 10 ? '侠义满级' : level > 5 ? `下一套皮肤在 ${level < 7 ? 7 : 10} 级解锁` : ''].filter(Boolean).join(' · ');
}
