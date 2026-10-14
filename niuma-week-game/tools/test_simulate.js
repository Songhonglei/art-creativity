// 模拟工具的失败路径回归：故障只注入隔离 VM，不修改游戏文件。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, 'simulate.js');
const source = fs.readFileSync(script, 'utf8');

function runFixture(enginePatch) {
  const output = [];
  const fakeProcess = { argv: ['node', script, '1'], exitCode: 0 };
  const fakeFs = {
    readFileSync(file, encoding) {
      const text = fs.readFileSync(file, encoding);
      return file.endsWith(path.join('js', 'engine.js')) ? text + '\n' + enginePatch : text;
    }
  };
  vm.runInNewContext(source, {
    __dirname,
    require(name) { return name === 'fs' ? fakeFs : require(name); },
    process: fakeProcess,
    console: {
      log(...values) { output.push(values.join(' ')); },
      error(...values) { output.push(values.join(' ')); }
    }
  }, { filename: script, timeout: 10000 });
  return { exitCode: fakeProcess.exitCode, output: output.join('\n') };
}

const engineFailure = runFixture("window.Engine.pickEvent = () => { throw new Error('fixture-pick-error'); };");
assert.equal(engineFailure.exitCode, 1, '捕获引擎异常后必须以失败退出');
assert.match(engineFailure.output, /fixture-pick-error/);

const repeatedEvent = runFixture('window.Engine.pickEvent = () => window.EV_BOSSES[0];');
assert.equal(repeatedEvent.exitCode, 1, '一次性事件重复必须以失败退出');
assert.match(repeatedEvent.output, /staff\/huang ev_boss_mon/, '重复事件诊断必须包含实际人设');

const run = args => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10000 });
const first = run(['30', '--seed=42']);
const replay = run(['30', '--seed=42']);
assert.equal(first.status, 0, first.stderr);
assert.equal(replay.status, 0, replay.stderr);
assert.equal(first.stdout, replay.stdout, '同种子模拟结果必须完全可复现');
assert.equal(run(['0']).status, 1, '零局数必须拒绝');
assert.equal(run(['1', '--seed=NaN']).status, 1, '非法种子必须拒绝');

console.log('✓ 模拟工具回归通过：引擎异常、重复事件、种子复现、非法参数');
