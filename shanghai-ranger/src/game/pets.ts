import type { Pet, PetAttribute, PetGrowth } from './types';

export const PET_IDS: Pet[] = ['orangeCat', 'corgi', 'shiba'];
export const PET_XP = [40, 60, 90, 120, 160, 200, 250, 300, 360];
export const PET_NAMES: Record<Pet, string> = { orangeCat: '橘座', corgi: '基哥', shiba: '柴大侠' };
export const PETS = [
  { id: 'orangeCat' as Pet, name: '橘猫', role: '保命', desc: '回血护盾，危急护主', skill: '护主', traits: ['护主', '回春'], traitDescriptions: ['自动护主冷却 45 → 38 秒', '主动回血增加最大气血的 3%'] },
  { id: 'corgi' as Pet, name: '柯基', role: '续航', desc: '回体减耗，持久行动', skill: '回体', traits: ['节能', '回气'], traitDescriptions: ['主动减耗多持续 2 秒', '常驻回体每秒再增加 2 点'] },
  { id: 'shiba' as Pet, name: '柴犬', role: '探索与破绽', desc: '寻踪补给，识破弱点', skill: '寻踪', traits: ['探路', '识破'], traitDescriptions: ['引路足迹多持续 4 秒', '识破增伤再增加 4%'] },
];
export interface PetSkin { id: string; level: number; name: string; desc: string; colors: [string, string, string] }
export const PET_SKINS: Record<Pet, PetSkin[]> = {
  orangeCat: [
    { id: 'cat-original', level: 1, name: '弄堂大橘', desc: '橘色虎斑 · 青铜项圈', colors: ['#df8b3f', '#337d83', '#d2ac59'] },
    { id: 'cat-red-scarf', level: 4, name: '平安红巾', desc: '朱红三角巾 · 白玉平安结', colors: ['#ac303f', '#efe1c1', '#c39948'] },
    { id: 'cat-guardian', level: 7, name: '弄堂护卫', desc: '靛青护肩 · 黄铜护心片', colors: ['#284963', '#bb9555', '#84a4a2'] },
    { id: 'cat-golden-bell', level: 10, name: '金铃守护', desc: '酒红锦披 · 双铃金边肩饰', colors: ['#762b46', '#ddbb67', '#e8cfa0'] },
  ],
  corgi: [
    { id: 'corgi-original', level: 1, name: '街角小基', desc: '黄背白胸 · 湖绿项圈', colors: ['#d5a05b', '#337d83', '#f0dfc2'] },
    { id: 'corgi-harness', level: 4, name: '轻装背带', desc: '湖绿交叉背带 · 便携水壶', colors: ['#308c86', '#d7ddd0', '#c49b58'] },
    { id: 'corgi-supply', level: 7, name: '补给小队', desc: '橙色双侧包 · 白色缝章', colors: ['#cb692f', '#efe3c9', '#4a645f'] },
    { id: 'corgi-expedition', level: 10, name: '远行伙伴', desc: '橄榄远行包 · 卷毯与双壶', colors: ['#596b43', '#c8ab79', '#df8443'] },
  ],
  shiba: [
    { id: 'shiba-original', level: 1, name: '赤柴认路', desc: '赤柴白腹 · 铜牌卷尾', colors: ['#bd7841', '#337d83', '#d2ac59'] },
    { id: 'shiba-tracker', level: 4, name: '寻踪围巾', desc: '靛蓝长围巾 · 黄铜罗盘章', colors: ['#385b8a', '#bfa35e', '#c9d7df'] },
    { id: 'shiba-detective', level: 7, name: '街巷侦探', desc: '格纹猎鹿帽 · 卡其短衣', colors: ['#957b54', '#493d32', '#d1b986'] },
    { id: 'shiba-inspector', level: 10, name: '沪上探长', desc: '深墨斗篷 · 探长章与观察镜', colors: ['#253a40', '#c7a35b', '#8eaaad'] },
  ],
};
const integer = (value: unknown, fallback: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : fallback;
export const emptyGrowth = (level = 1): PetGrowth => ({ level, xp: 0, attributes: { guard: 0, vigor: 0, specialty: 0 }, trait: null, skin: '' });
export function newPets(level = 1): Record<Pet, PetGrowth> {
  const growth = (pet: Pet) => ({ ...emptyGrowth(level), skin: PET_SKINS[pet][0].id });
  return { orangeCat: growth('orangeCat'), corgi: growth('corgi'), shiba: growth('shiba') };
}
export const availablePoints = (growth: PetGrowth) => growth.level - 1 - Object.values(growth.attributes).reduce((sum, n) => sum + n, 0);
export const petSkin = (pet: Pet, id: string) => PET_SKINS[pet].find(skin => skin.id === id) ?? PET_SKINS[pet][0];
export function readPets(raw: unknown, legacyLevel = 1): Record<Pet, PetGrowth> {
  const pets = newPets(legacyLevel);
  for (const pet of PET_IDS) {
    const value = (raw as Record<Pet, Partial<PetGrowth>> | null)?.[pet];
    if (!value || typeof value !== 'object') continue;
    const growth = pets[pet]; growth.level = Math.max(1, integer(value.level, 1, 10));
    growth.xp = growth.level === 10 || typeof value.xp !== 'number' || !Number.isFinite(value.xp) ? 0 : Math.max(0, Math.min(PET_XP[growth.level - 1] - .5, Math.round(value.xp * 2) / 2));
    let budget = growth.level - 1;
    for (const key of ['guard', 'vigor', 'specialty'] as PetAttribute[]) { growth.attributes[key] = Math.min(budget, integer(value.attributes?.[key], 0, 5)); budget -= growth.attributes[key]; }
    growth.trait = growth.level >= 5 && (value.trait === 'first' || value.trait === 'second') ? value.trait : null;
    const skin = PET_SKINS[pet].find(skin => skin.id === value.skin && skin.level <= growth.level);
    growth.skin = (skin ?? PET_SKINS[pet][0]).id;
  }
  return pets;
}
export function gainPetXp(growth: PetGrowth, amount: number) {
  const oldLevel = growth.level;
  if (growth.level === 10) return false;
  growth.xp += amount;
  while (growth.level < 10 && growth.xp >= PET_XP[growth.level - 1]) { growth.xp -= PET_XP[growth.level - 1]; growth.level++; }
  if (growth.level === 10) growth.xp = 0;
  return growth.level > oldLevel;
}
export function petStats(pet: Pet, growth: PetGrowth) {
  const { level, attributes: a, trait } = growth, t = (level - 1) / 9;
  return {
    heal: .12 + t * .08 + a.specialty * .02 + (pet === 'orangeCat' && trait === 'second' ? .03 : 0),
    guard: 3 + Math.floor(t * 6), shield: level >= 8 ? .12 : level >= 3 ? .08 : 0,
    rescue: .30 + a.guard * .02,
    cooldown: Math.max(12, (level >= 8 ? 20 : level >= 4 ? 22 : 24) - a.vigor * .6),
    stamina: Math.round(44 + t * 14) + a.specialty * 3,
    regen: 3 + t * 6 + (pet === 'corgi' && trait === 'second' ? 2 : 0),
    economy: level >= 8 ? .20 : level >= 3 ? .15 : 0,
    economyDuration: level >= 3 ? (level === 10 ? 6 : 4) + (trait === 'first' ? 2 : 0) : 0,
    weakness: .12 + t * .08 + a.specialty * .02 + (pet === 'shiba' && trait === 'second' ? .04 : 0),
    range: 8 + t * 4 + a.specialty * .8,
    markDuration: level >= 8 ? 12 : level >= 3 ? 10 : 8,
    guideDuration: 8 + t * 4 + (pet === 'shiba' && trait === 'first' ? 4 : 0),
    autoCooldown: pet === 'orangeCat' && trait === 'first' ? 38 : 45,
  };
}
export const PET_MILESTONES: Record<Pet, [number, string][]> = {
  orangeCat: [[1, '回血、常驻减伤与低血护主'], [3, '溢出治疗转为 4 秒护盾'], [5, '选择护主或回春特性'], [8, '护盾上限提升至最大气血 12%'], [10, '自动护主额外恢复 5% 气血']],
  corgi: [[1, '回体、常驻回体与低体补给'], [3, '主动后 4 秒内消耗体力减少 15%'], [5, '选择节能或回气特性'], [8, '体力减耗提升至 20%'], [10, '减耗基础持续时间提升至 6 秒']],
  shiba: [[1, '地面足迹引路、战斗标记弱点'], [3, '发现附近补给、标记延至 10 秒'], [5, '选择探路或识破特性'], [8, '标记延至 12 秒'], [10, '调查后接续一次、识破再留半额一击']],
};
