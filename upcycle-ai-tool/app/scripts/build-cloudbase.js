'use strict';

// 生成 CloudBase 部署源：静态子目录 site/ + HTTP 云函数 functions/upcycle-api/。
// 静态站上传到子目录 /upcycle/，不覆盖环境里已有的根目录 index.html。
const fs = require('node:fs');
const path = require('node:path');

const APP = path.join(__dirname, '..');
const OUT = path.join(APP, 'deploy-cloudbase');
const FN = path.join(OUT, 'functions', 'upcycle-api');
// 静态托管域名只走 COS，/upcycle/api/* 必须发到 HTTP 网关域名；函数已放行该来源。
const GATEWAY_API = process.env.UPCYCLE_GATEWAY_API
  || 'https://evansongdev-d3gwank9e76835e8b-1343046532.ap-shanghai.app.tcloudbase.com/upcycle/api/';

function copyJsTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, {
    recursive: true,
    filter: (src) => !src.includes('node_modules')
      && (fs.statSync(src).isDirectory() || src.endsWith('.js'))
  });
}

function main() {
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(FN, { recursive: true });

  fs.cpSync(path.join(APP, 'public'), path.join(OUT, 'site'), { recursive: true });
  const indexPath = path.join(OUT, 'site', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const tagged = html.replace(
    '<meta name="upcycle-api-base" content="">',
    `<meta name="upcycle-api-base" content="${GATEWAY_API}">`
  );
  if (tagged === html) throw new Error('未找到 API 网关地址占位，部署源构建中止');
  fs.writeFileSync(indexPath, tagged);

  fs.copyFileSync(path.join(APP, 'cloudbase', 'function', 'index.js'), path.join(FN, 'index.js'));
  fs.copyFileSync(path.join(APP, 'cloudbase', 'cloudbaserc.json'), path.join(OUT, 'cloudbaserc.json'));
  copyJsTree(path.join(APP, 'lib'), path.join(FN, 'lib'));
  fs.writeFileSync(path.join(FN, 'package.json'), JSON.stringify({
    name: 'upcycle-api', version: '1.0.0', private: true,
    main: 'index.js', dependencies: {}
  }, null, 2) + '\n');

  const count = (dir) => {
    let n = 0;
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p); else n++;
      }
    })(dir);
    return n;
  };
  console.log('部署源：' + OUT);
  console.log('接口地址注入：' + GATEWAY_API);
  console.log('静态文件 ' + count(path.join(OUT, 'site')) + ' 个 → 云端 /upcycle/');
  console.log('云函数文件 ' + count(FN) + ' 个 → upcycle-api');
  console.log('包含 .env：' + (fs.existsSync(path.join(OUT, '.env')) ? '是（错误）' : '否'));
}

main();
