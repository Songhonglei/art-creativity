// 加载 data/ 下全部数据文件（模拟浏览器 window 环境），输出 JSON 供校验脚本使用
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'data');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f });
}
const out = {
  characters: sandbox.window.CHARACTERS,
  endings: sandbox.window.ENDINGS,
  achievements: sandbox.window.ACHIEVEMENTS,
  personaEpilogues: sandbox.window.PERSONA_EPILOGUE,
  personaOverrides: sandbox.window.PERSONA_ENDING_OVERRIDE,
  filler: sandbox.window.EV_FILLER,
  events: {
    general: sandbox.window.EV_GENERAL,
    lineA: sandbox.window.EV_LINE_A,
    lineB: sandbox.window.EV_LINE_B,
    lineC: sandbox.window.EV_LINE_C,
    bosses: sandbox.window.EV_BOSSES
  }
};
process.stdout.write(JSON.stringify(out));
