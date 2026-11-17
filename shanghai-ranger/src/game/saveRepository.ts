import { readProgress, SAVE_KEY } from './simulation';
import { latestWriter } from './latestWriter';
import type { GameStorage } from './storage';
import type { Progress } from './types';

export const SAVE_SLOTS = { primary: 'shanghai-ranger-progress-v1', backup: 'shanghai-ranger-progress-v1-backup', migration: 'shanghai-ranger-legacy-import', quarantine: 'shanghai-ranger-damaged-save' } as const;
interface Envelope { format: 1; savedAt: number; progress: Progress; checksum: string }
function checksum(savedAt: number, progress: Progress) {
  const payload = JSON.stringify({ savedAt, progress }); let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) hash = Math.imul(hash ^ payload.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function encodeSave(progress: Progress, savedAt: number) {
  return JSON.stringify({ format: 1, savedAt, progress, checksum: checksum(savedAt, progress) } satisfies Envelope);
}
function decode(raw: string): Envelope {
  const value = JSON.parse(raw);
  if (value?.format !== 1 || !Number.isFinite(value.savedAt) || !value.progress) throw Error('存档版本或内容异常');
  if (value.checksum !== checksum(value.savedAt, value.progress)) throw Error('存档校验不一致');
  return { format: 1, savedAt: value.savedAt, progress: readProgress(JSON.stringify(value.progress)), checksum: value.checksum };
}
export class SaveReadError extends Error {
  constructor(message: string, readonly originals: Record<string, string | null>) { super(message); }
}
/** v0.9.5 never writes these slots. Both copies contain a complete acknowledged
 * snapshot; selecting the newer valid one also tolerates a single late old write. */
export async function openSaveRepository(storage: GameStorage) {
  const [primary, backup] = await Promise.all([storage.get(SAVE_SLOTS.primary), storage.get(SAVE_SLOTS.backup)]);
  const originals: Record<string, string | null> = { [SAVE_SLOTS.primary]: primary, [SAVE_SLOTS.backup]: backup };
  const valid: { slot: string; data: Envelope }[] = [];
  for (const [slot, raw] of Object.entries(originals)) if (raw !== null) {
    try { valid.push({ slot, data: decode(raw) }); } catch { /* Keep original bytes for recovery; never silently create a new game. */ }
  }
  // A format from a future application must not be overwritten by this version.
  const future = Object.values(originals).some(raw => {
    try { if (raw === null) return false; const value = JSON.parse(raw); return (value?.format !== undefined && value.format !== 1) || (value?.progress?.version !== undefined && ![1, 2, 3].includes(value.progress.version)); }
    catch { return false; }
  });
  if (future) throw new SaveReadError('存档来自其他版本。原存档未覆盖，请使用对应版本，或粘贴有效存档恢复。', originals);
  let progress: Progress, notice = '', migration: string | null = null;
  if (valid.length) {
    valid.sort((a, b) => b.data.savedAt - a.data.savedAt);
    progress = valid[0].data.progress;
    if (valid[0].slot === SAVE_SLOTS.backup && (valid.length < 2 || valid[0].data.savedAt > valid[1].data.savedAt)) notice = '已从最近有效备份恢复进度。';
  } else if (primary !== null || backup !== null) {
    throw new SaveReadError('存档暂时无法读取，原始内容已保留。请留存原始内容，或粘贴有效存档恢复。', originals);
  } else {
    migration = await storage.get(SAVE_KEY); originals[SAVE_KEY] = migration;
    try { progress = readProgress(migration); } catch (error) { throw new SaveReadError(error instanceof Error ? error.message : '旧存档无法读取。', originals); }
  }
  let lastStamp = valid[0]?.data.savedAt ?? 0;
  let protect = Object.entries(originals).some(([slot, raw]) => raw !== null && slot !== 'shanghai-night-watch-v1' && !valid.some(v => v.slot === slot));
  const save = latestWriter<string>(async raw => {
    if (protect) { await storage.set(SAVE_SLOTS.quarantine, JSON.stringify(originals)); protect = false; }
    if (migration !== null) { await storage.set(SAVE_SLOTS.migration, migration); migration = null; }
    await storage.set(SAVE_SLOTS.backup, raw);
    await storage.set(SAVE_SLOTS.primary, raw);
  }, 12000);
  return {
    progress, notice, needsMigration: migration !== null,
    save(value: Progress) {
      lastStamp = Math.max(Date.now(), lastStamp + 1);
      return save(encodeSave(value, lastStamp));
    },
  };
}

export async function restoreSaveFile(storage: GameStorage, text: string, originals: Record<string, string | null>) {
  const parsed = JSON.parse(text), progress = parsed?.format === 1 ? decode(text).progress : readProgress(text);
  const raw = encodeSave(progress, Date.now());
  await storage.set(SAVE_SLOTS.quarantine, JSON.stringify(originals));
  await storage.set(SAVE_SLOTS.backup, raw); await storage.set(SAVE_SLOTS.primary, raw);
}
