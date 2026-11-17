export class StorageTimeoutError extends Error {
  constructor() { super('本地存储响应超时。请稍后重试；若仍未恢复，请重新加载。'); }
}
/** One active operation and one newest pending payload. A timeout never unlocks
 * the underlying operation: a late native write must finish before a newer write. */
export function latestWriter<T>(write: (value: T) => Promise<unknown>, timeoutMs = 8000) {
  type Job = { value: T; resolve: () => void; reject: (e: unknown) => void };
  let active: Job | null = null, pending: Job | null = null, blocked = false;
  const start = (job: Job) => {
    active = job;
    const timer = setTimeout(() => {
      blocked = true; job.reject(new StorageTimeoutError());
      pending?.reject(new StorageTimeoutError()); pending = null;
    }, timeoutMs);
    const finish = () => {
      clearTimeout(timer); active = null; blocked = false;
      const next = pending; pending = null; if (next) start(next);
    };
    Promise.resolve().then(() => write(job.value)).then(() => { job.resolve(); finish(); }, error => { job.reject(error); finish(); });
  };
  return (value: T): Promise<void> => new Promise((resolve, reject) => {
    if (blocked) { reject(new StorageTimeoutError()); return; }
    const job = { value, resolve, reject };
    if (!active) start(job);
    else { pending?.reject(Error('已合并到较新的存档。')); pending = job; }
  });
}

export function withStorageTimeout<T>(operation: Promise<T>, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new StorageTimeoutError()), timeoutMs);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
