# 牛马求生记 · 一周打工闯关

一个纯前端、零依赖的职场生存小游戏。在虚构的“卷卷科技”度过一周，面对画饼、甩锅、客户变卦和人情往来，做出自己的选择。

> 本游戏纯属虚构。如有雷同，说明你也在上班。

当前版本：**v3.15**。源码收录于 [Songhonglei/art-creativity](https://github.com/Songhonglei/art-creativity) 的 `niuma-week-game/`，各项目相互独立。

在线体验：[牛马求生记](https://niuma-week-game.vercel.app/)。由 Vercel 独立部署，关联本仓库 `main` 分支的 `niuma-week-game/` 目录，推送更新后自动发布。

## 本地运行

无需安装前端依赖或构建。克隆聚合仓库后进入游戏目录：

```bash
git clone https://github.com/Songhonglei/art-creativity.git
cd art-creativity/niuma-week-game
python3 -m http.server 8080
```

浏览器打开 <http://localhost:8080>。也可以直接打开 `index.html`；推荐使用静态服务器运行。

可以将整个游戏文件夹部署到支持静态文件的网站服务。保留目录结构和相对资源路径；`index.html` 是入口，不需要后端、数据库或账号系统。

## 游戏内容

- **三条职级线，十一种人设**：一线牛马、中层夹心和老板本板，各有技能、目标和专属结局台词。
- **一周七天，周一至周六每天六个时段、周日两个时段**：每日 Boss、随机事件、两轮追问和跨天连锁，让前面的选择影响后续剧情。
- **六项属性的取舍**：心态、KPI / 现金流、人缘 / 士气、信任、摸鱼 / 自由度和存款。主页面紧凑显示四项，完整数值在工牌中查看。
- **IM / OA 式界面**：移动端优先，聊天内部滚动、选项居中、背包浮层与道具卡片；限时题在打开抽屉或切入后台时暂停。
- **十二类基础结局与三十六个成就**：不同职级采用不同的绩效与评语体系，人设会改变结局文案。
- **结局与周报分享**：生成图片，可预览、下载，在设备支持时调用系统分享。

存档保存在当前浏览器的 `localStorage`。相同浏览器和域名下可以续玩；清理网站数据、换域名或换设备不会自动继承存档。

## 项目结构

```text
niuma-week-game/
├── index.html          # 页面入口
├── manifest.json       # 添加到主屏幕的配置
├── css/style.css       # 页面样式
├── js/
│   ├── state.js        # 存档与数据校验
│   ├── engine.js       # 事件抽取、判定、属性、结局与成就
│   ├── ui.js           # 页面、弹层、倒计时与分享图
│   └── main.js         # 游戏流程
├── data/               # 角色、事件、微事件、结局与成就
├── icons/              # 游戏图标
├── tools/              # 校验、模拟与回归工具
└── DESIGN.md           # 设计过程与玩法说明
```

设计文档包含早期迭代记录；当前行为以源码和测试为准。

## 校验与测试

开发校验需要 Python 3 和 Node.js；端到端工具需要 Node.js 22+ 及本机 Chrome / Chromium。

```bash
python3 tools/validate_data.py
node tools/test_game.js
node tools/test_simulate.js
node tools/simulate.js 1200 --seed=20261014
```

浏览器端到端回归：

```bash
node tools/e2e.js
```

工具会自行启动临时静态服务器和浏览器。找不到浏览器时，可通过 `CHROME_PATH` 指定可执行文件。首次运行自动生成本机视觉基线，后续运行进行比对；浏览器、系统字体或明确的界面改动会影响像素结果，确认改动后可用 `--update-baseline` 更新。视觉基线属于本机生成产物，不纳入源码。

## 扩展剧情

在 `data/` 对应事件池中添加事件；常用字段为 `id`、`title`、`lines`、`choices`、`days`、`slots` 和 `cond`。选项支持属性效果、概率判定、道具门槛、追问和跨天连锁。

- 三条职级线共用事件时，用 `variants` 适配身份文案。
- 证据类判定使用 `judge.evidence`；排程事件使用 `scheduledOnly` 或 `scheduledOnlyJobs`。
- 金额效果以“月薪”为单位，与剧情中的工资口径保持一致。
- 增改内容后运行数据校验和规则回归。
- 修改静态资源后同步更新 `index.html` 的 `?v=` 参数，避免缓存旧文件。

## 许可证

沿用聚合仓库的 **GNU GPLv3**，完整文本见 [LICENSE](LICENSE)。
