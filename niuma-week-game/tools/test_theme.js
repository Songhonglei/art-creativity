// 最小页面环境与无存储权限时的主题初始化回归，避免外观偏好阻断游戏启动。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/theme.js'), 'utf8');

function boot(saved, blocked = false) {
  const storage = new Map([['niuma_theme', saved], ['niuma_week_save_v1', '{"day":4}']]);
  const meta = { content: '#101116' };
  const ctx = vm.createContext({
    window: {}, document: { documentElement: { dataset: {} }, querySelector: () => meta },
    localStorage: {
      getItem(k) { if (blocked) throw new Error('SecurityError'); return storage.get(k); },
      setItem(k, v) { if (blocked) throw new Error('QuotaExceededError'); storage.set(k, v); }
    }
  });
  vm.runInContext(source, ctx);
  return { theme: ctx.window.Theme, storage, meta };
}

assert.equal(boot(null).theme.current(), 'dark');
for (const id of ['dark', 'light', 'eye', 'fantasy']) {
  const { theme, storage } = boot(id);
  assert.equal(theme.current(), id);
  assert.equal(theme.apply('invalid'), false);
  assert.equal(theme.current(), id);
  theme.apply('light');
  assert.equal(storage.get('niuma_theme'), 'light');
  assert.equal(storage.get('niuma_week_save_v1'), '{"day":4}');
}
for (const invalid of ['<script>', '__proto__', 'system', '']) assert.equal(boot(invalid).theme.current(), 'dark');
const blocked = boot('fantasy', true);
assert.equal(blocked.theme.current(), 'dark');
assert.equal(blocked.theme.apply('eye'), true);
assert.equal(blocked.theme.current(), 'eye');
assert.equal(blocked.meta.content, '#e4eadc');
console.log('✓ 主题回归通过：四种偏好恢复、非法值兜底、存储禁用与写入失败、存档隔离');
