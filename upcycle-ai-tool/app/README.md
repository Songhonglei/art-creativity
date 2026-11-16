# 万物改造局 · 本地运行说明

上传闲置物照片（或选内置示例），得到实用款 / 好看款 / 脑洞款三种可制作的改造方案，可按工具与预算追加限制，导出制作清单与分享卡。

零第三方依赖：原生 HTML/CSS/JS + Node 原生 HTTP 服务。Node >= 18（本机验证用 v22.22.2）。

## 启动

```bash
cd app
npm start                 # 默认 http://127.0.0.1:4173
PORT=4190 npm start       # 换端口
```

浏览器打开 `http://127.0.0.1:4173/` 即可。服务只监听 127.0.0.1，不对外暴露。

## 运行模式与接口配置

不配置任何变量时自动进入**示例模式**：使用内置规则数据，明确标注「示例方案」，不调用模型、不做图像识别。上传新物品需手动填写「这是什么」才能体验规则示例。

要连接模型，把 `.env.example` 复制为 `.env` 并填写（`.env` 已被 `.gitignore` 忽略，真实环境变量优先）：

| 变量 | 说明 |
| --- | --- |
| `LLM_BASE_URL` | 兼容 OpenAI chat/completions 的服务地址，服务端会自动拼 `/chat/completions` |
| `LLM_API_KEY` | 密钥，只留在服务端，永不进入前端响应 |
| `LLM_MODEL` | 模型名 |
| `LLM_VISION` | `true` 才把图片发给模型；否则图片不上传。**线上已开启**（`npm run deploy:live` 默认注入 `true`，显式 `UPCYCLE_VISION=false` 才关闭） |
| `LLM_DISABLE_THINKING` | `true` 才对 Qwen/DashScope 传 `enable_thinking:false`，避免长 JSON 方案生成被网关超时打断；其他端点不传 |
| `LLM_JSON_MODE` | `true` 才对兼容端点传 `response_format:{type:'json_object'}`，强制可解析 JSON；其他端点不传 |
| `LLM_TIMEOUT_MS` | 单次调用超时，默认 20000，覆盖到响应体完整读完 |
| `PORT` | 本地端口，默认 4173 |

三个必需变量齐备才进入「模型模式」。配置不泄露到 `/api/config`，前端也不能指定任意上游地址。模型输出一律经服务端结构校验、净化，再按预算与工具重新校验；失败会保留输入并提示重试，不会静默降级成示例却仍声称模型调用成功。

**线上现状（2026-11-07）**：云函数 `upcycle-api` 已接入真实模型 `qwen3.8-flash`（阿里云 MaaS 的 OpenAI 兼容端点），`/api/config` 返回 `mode=live` / `vision=true`；三方案由模型生成后再经服务端结构、预算与工具校验，OCR 仍是腾讯云真实文字识别。**视觉已开启**：上传照片会发给模型看图，`recognized` 返回物品与材质（`source=vision`），前端会如实显示「（识别结果）」并允许纠正。凭据由 `npm run deploy:live` 从本机 `~/.workbuddy/models.json` 读取后注入云函数环境变量，不写进仓库文件、不进静态站、不下发前端。`LLM_DISABLE_THINKING=true` 是必要优化：默认「思考」模式生成完整三方案实测 76 秒（会被网关超时打断），关闭后约 22 秒。

**纠正上一轮的错误结论**：此前只看端点 `/models` 列表（21 个模型里没有 VL 命名模型）就断定「没有视觉理解模型、不能开视觉」，这是错的。真发 `image_url` 请求后，`qwen3.8-flash` 准确读出了自检图上的 `OCR READY 2026 / UPCYCLE CHECK 240`；用真实物品照片走完整链路，`recognized` 返回「喷雾瓶 / 塑料」、`visionUsed=true`。模型列表里没有 `*-vl` 不等于不支持视觉输入，结论必须以真请求为准。另一个实测坑：DashScope 在 `response_format:json_object` 下要求 messages 里出现 `json` 字样；本项目 `SYSTEM_PROMPT` 已含「只输出一个 JSON 对象」，完整链路实测正常，裸测时若自定义提示词没有这个字样会返回 `invalid_parameter_error`。

## 照片文字识别（真实 OCR）

首页上传照片后可点「识别文字」，服务端调用腾讯云 `GeneralBasicOCR`（`lib/tcapi.js` 用 Node 内置 crypto 做 TC3 签名，零第三方依赖），返回照片上**真实读到的文字**、置信度与可核对的文字线索。OCR 只认包装/标签文字，不代表看懂物品；结果可纠正，前端不会把它标成「识图结果」。

凭据优先读 `.env` 或云函数环境变量里的 `TENCENT_CLOUD_SECRET_ID / TENCENT_CLOUD_SECRET_KEY / TENCENT_CLOUD_TOKEN`；未配置才回落运行时注入的 `TENCENTCLOUD_SECRETID/SECRETKEY/SESSIONTOKEN` 临时密钥。**2026-11-07 线上 OCR 已打通，用的是运行时临时密钥，无需配置任何长期密钥。**

排查结论（如实记录）：文字识别服务本来就已开通（2026 年 11 月赠送包 30000 次、已用 0；后付费关闭），`AuthFailure.UnauthorizedOperation` 不是「未开通」，而是运行时凭证扮演的 CAM 角色没有 OCR 权限。用 `GET /api/diag` 新增的 `identity`（STS `GetCallerIdentity`）确认该角色是 **`TCB_QcsRole`**（角色 ID `4611686018448296766`），不是 `SCF_QcsRole`（`4611686018448769221`）；先给 `SCF_QcsRole` 加策略无效，随后已撤销。最终由账号本人在 CAM 给 `TCB_QcsRole` 关联预设策略 **`QcloudOCRReadOnlyaccess`**（含调用所有 OCR 接口，不含开通/关闭服务与后付费设置），鉴权即通过。CloudBase 云函数页的「权限控制」只管客户端调用函数，与运行角色权限无关，改它无效。凭据不进前端、不进日志、不落静态站。

`/api/config` 只回 `ocr.configured` 布尔值；`已配置 ≠ 有权限`，真实调用失败会返回明确错误码（无权限/图片异常/超时/上游失败）并提示可重试，绝不谎称识别成功。云函数另提供只读 `GET /api/diag`，用 `scripts/fixtures/ocr-check.png`（带可识别文字的 PNG）真发一次 OCR，返回 `probe.ok`、`identity.arn`，用来复测权限是否生效；图片太小会被 OCR 判为 `ImageDecodeFailed`，不要改成 1×1 占位图。

识别文字会随 `/api/ideas` 一起交给服务端：示例模式下从原文推物品/材质线索（不信任前端传来的候选值），模型模式下写进提示词给模型参考；制作清单会标注「照片上真实读到的文字（文字识别），不是看图识别结果」。视觉开启后模型**另外**依据图片判断物品与材质，两者来源不同：前端分别标「（照片文字线索）」与「（识别结果）」，不把 OCR 冒充识图。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/config` | 公共配置、工具表、示例表、文字识别能力状态 |
| POST | `/api/ideas` | 生成三方案。字段：`sampleId` / `image`(data URL) / `ocrText` / `item` / `material` / `description` / `tools` / `budget` / `forbidden` / `extra` |
| POST | `/api/refine` | 按新限制重做单个方案。字段：`base` / `planId` / `currentPlan` / `specs` / `constraints` |
| POST | `/api/ocr` | 真实文字识别。字段：`image`(data URL)；返回识别行、置信度、文字线索与说明 |
| GET | `/api/diag` | 仅云函数：只读能力自检，真发一次 OCR 探测并回显结果码，不含凭据 |

图片限 JPEG / PNG / WebP、5MB、单边不超过 4096 像素，并校验文件头；文本与补充要求有长度上限。

**请求体体积是另一条硬限制**：CloudBase HTTP 网关对事件云函数的请求体实测约 100 KiB 上限，超过直接返回 `413 EXCEED_MAX_PAYLOAD_SIZE`（实测 100,035 字节的 body 能到云函数，102,435 字节被拒），手机原图 2–5MB 根本发不到服务端。因此前端上传后**先在浏览器压缩**：`public/app.js` 的 `compressDataUrl` 等比缩放（最长边 1024→384）并逐档降 JPEG 质量，直到 data URL ≤ 85,000 字符，白底填充避免透明 PNG 变黑；`state.image`、OCR、视觉、分享卡都用这张压缩图，原图不上传。预览区会显示实际压缩后的尺寸与体积。压缩会让小字识别率下降，物品拿不准时仍可手动填「这是什么」。服务端 5MB 上限保留作为兜底，网关 413 会给出明确提示而不是静默失败。

## 功能位置（便于截图）

- 首页：上传区 + 「识别文字」按钮与识别原文/文字线索、三个内置示例、物品/材质/一句描述、已有工具（常用直达 + 更多工具）、预算；标题下显示文字识别与方案生成的真实能力状态。
- 结果页：模式说明一处、三张方案卡（各带结构示意 SVG）、可行/不可行状态、按需展开的物品/材质纠正表单。
- 制作视图：原物与结构示意并排、材料与费用、工具、注意点、可勾选步骤、追加限制、清单与分享卡导出。
- 右上角收藏：存 localStorage，刷新后仍在。

结构示意只表示尺寸与折叠/连接关系，不是实物成品；费用为估计值，未核实材质不保证安全、承重与防水。

## 尺寸标注约定

`diagram.dims` 是宽 / 深 / 高文字标注的唯一真源：详情结构图、分享卡（直接复用详情 SVG）、Markdown 清单都读它。以「三格桌面文件立架」为例：`w=240` 宽、`h=160` 深（顶面斜向）、`d=90` 高（立板竖向）；横向标「宽 240 mm」、斜向标「深 160 mm」、竖向标「高 90 mm」，步骤里的裁板、折叠与三等分连接按同一组数值表述。

## 验证

```bash
npm run verify:api       # 接口层：启动 4 个本地服务，含 scripts/mock-llm.js 本地模拟上游
npm run verify:browser   # 浏览器层：本机 Chrome 无头 CDP 真实点击 / 下载 / 375px 视口 / 大图上传压缩
node scripts/verify-final.js        # 最终针对性复核（logo / 来源文案 / 瓶子分支 / 导出）
node scripts/verify-ocr.js          # 文字识别链路：本地 mock OCR，含成功/无文字/无权限/超时/来源标注
npm run verify:guard     # 云函数护栏：限流 429 / 来源隔离 / 带 query 路由 / 部署源不含密钥（不联网）
node scripts/verify-cloud-ocr.js    # 线上真实状态：模式断言、自检、OCR、带真实照片的视觉识图、按模式回归
npm run verify:cloudbase   # 线上浏览器端到端回归（自适应示例/模型模式）
npm run verify:stability   # 线上真实模型：3 种不同输入连续生成，核对 source=llm 与三款式
npm run verify:all         # 以上全部按顺序跑一遍（含线上检查，部署后再跑）
```

`verify-cloud-ocr.js` 默认断言线上 `mode=live`：若普通 `tcb fn deploy` 用空 `envVariables` 把模型配置覆盖掉，脚本会直接失败，而不是静默按示例模式继续「通过」。确需回滚到示例模式时用 `UPCYCLE_EXPECT_MODE=demo` 显式放宽。

`scripts/mock-llm.js` 是本机模拟上游，**不是真实大模型**，只用于验证请求链路、结构校验与失败处理，不代表真实模型调用成功。截图与下载产物落在 `output/`。逐项结果见 `验证记录.md`。

最终针对性复核：`node scripts/verify-final.js`（独立端口 4174 / 4175 / 8789 / 9335，不影响 4173 常驻预览），覆盖 logo / favicon、信息来源文案、瓶子不裁切分支的界面与导出；产物在 `output/final/`。

## 品牌标识

选定 A「折角回环」。`public/logo.svg` 是唯一矢量源：网页左上角 `<img class="brand-mark">` 与 `<link rel="icon" type="image/svg+xml">` 都引用它。`favicon-16.png` / `favicon-32.png` / `favicon-180.png` 由 `node scripts/make-favicon.js` 用本机无头 Chrome 把同一张 SVG 画进 Canvas 导出，用于不支持 SVG favicon 的浏览器与苹果触屏图标；换 logo 后重跑该脚本即可，不用另画一套。四版候选稿保留在 `output/logo-options/`。

## CloudBase 上线

**可分享网址**：https://evansongdev-d3gwank9e76835e8b-1343046532.tcloudbaseapp.com/upcycle/

| 部分 | 落点 |
| --- | --- |
| 环境 | 个人版 `evansongdev-d3gwank9e76835e8b`（ap-shanghai） |
| 前端 | 静态托管子目录 `/upcycle/`，**不覆盖**根目录已有的 `index.html` |
| 接口 | 事件型 HTTP 云函数 `upcycle-api`（Nodejs18.15，60s / 256MB，超时放宽以容纳真实模型与 OCR 调用） |
| 路由 | `*` → `/upcycle/api` → SCF `upcycle-api`（由 `--path` 自动创建） |

**为什么是跨域**：静态托管测试域名 `*.tcloudbaseapp.com` 只走 COS，`/upcycle/api/*` 会 404；接口必须发到 HTTP 网关域名 `*.ap-shanghai.app.tcloudbase.com`。后者是系统内部域名，API 拒绝手动加静态路由，所以无法做成同源。构建脚本把网关地址写进 `site/index.html` 的 `<meta name="upcycle-api-base">`，前端据此请求，云函数已放行静态托管来源并处理 OPTIONS 预检。本地预览该 meta 为空，仍走相对路径 `/api/*`。

**重新部署**（改完代码后）：只改云函数或模型配置用 `npm run deploy:live`；只有 `public/` 静态文件有改动时才需要额外跑静态托管命令。

```bash
npm run deploy:live                 # 构建 + 注入本机 Qwen 配置 + 部署云函数
cd deploy-cloudbase
tcb hosting deploy ./site upcycle -e evansongdev-d3gwank9e76835e8b --verify   # 仅静态文件改动时
cd .. && npm run verify:cloudbase
```

注意：`tcb hosting deploy` **不要加 `--prune`**（会删除根目录其他文件）；不要用 `--httpFn`（CLI 3.8.5 会要求 `scf_bootstrap` 走 Web 函数）；不要手动 `tcb routes add`（`*` 与系统内部域名都会被拒，用 `--path` 自动建）。部署源不含 `.env`、不含 `node_modules`。

**开启真实能力（已完成）**：OCR 用运行时临时密钥（`TCB_QcsRole` 关联 `QcloudOCRReadOnlyaccess`），无需长期密钥；模型用 `npm run deploy:live` 从本机 `~/.workbuddy/models.json` 读取 `qwen3.8-flash` 的 base URL 与 API Key 注入云函数环境变量。脚本只在部署瞬间把值写入生成物 `deploy-cloudbase/cloudbaserc.json`，部署结束立即还原；`deploy-cloudbase/` 已被 `.gitignore` 忽略，密钥不进仓库文件、不进静态站、不下发前端。**改完代码重新部署请用 `npm run deploy:live`**：直接跑 `tcb fn deploy` 且配置里 `envVariables` 为空时，可能会覆盖掉已注入的模型配置。配置后用 `GET /api/config` 确认 `mode=live`、`GET /api/diag` 复测 OCR 与上游地址，再用一次真实 `POST /api/ideas` 确认 `source=llm`。未配置时页面如实显示能力状态，OCR 按钮返回明确错误而不是假装识别成功。

**部署加固（2026-11-07 收尾）**：`deploy:live` 写密钥前先把 `deploy-cloudbase/cloudbaserc.json` 权限收紧到 `600`（`writeFileSync` 的 `mode` 只对新建文件有效，原来不生效），Ctrl+C / 终止信号 / 异常统一走幂等还原，避免中断后密钥留在生成物里；部署结束后查远端 `/api/config` 确认 `mode=live`，退出码 0 不再等于「线上真的生效」。部署模板若残留 `envVariables` 会直接中止。

**公开网址的护栏**：静态页谁都能打开，云函数里挂着真实模型密钥与 OCR 免费额度，因此加了两层轻量保护：`GET /api/diag` 的探测结果在同一容器内缓存 60 秒（响应带 `cached` / `cacheAgeMs`，加 `?fresh=1` 可强制重测），避免每次自检都真发一次 OCR + STS；`POST /api/ideas|refine|ocr` 按来源 IP 做 60 秒窗口计数，超限返回 429 `rate_limited` 并说明等一分钟再试。默认每来源每分钟 `ideas/refine` 各 12 次、`ocr` 24 次，可用云函数环境变量 `UPCYCLE_RATE_LIMIT` 调整（设 `0` 关闭）；网关没给来源 IP 时共用放大后的额度。**这是护栏不是强防护**：计数只在单个云函数容器内有效，容器回收即重置，需要硬限流仍需平台侧配置。CORS 白名单已放行测试域名与 `case.evansong.cn`（旧域名仍在白名单内），OPTIONS 预检实测 204 + `access-control-allow-origin: https://case.evansong.cn`。

**等待与超时**：线上真实模型方案生成实测 16–20 秒。首页能力状态行如实写出「通常 15–30 秒」，live 模式按钮按秒显示已等待时间；前端请求带 `AbortController`，计时器覆盖到响应体完整读完，`ideas/refine` 上限为服务端超时 +10 秒、`ocr` 25 秒、`config` 12 秒，超时给明确提示并保留输入，不会一直转圈。

**视觉识图（已开启）**：`LLM_VISION=true`，上传照片以 OpenAI 兼容的 `image_url`（data URL + `detail:low`）发给 `qwen3.8-flash`，物品与材质由模型看图判断，前端标注「（识别结果）」并允许纠正；OCR 是独立的文字识别，两者不混。实测带真实物品照片的 `POST /api/ideas` 返回 `visionUsed=true`、`recognized={item:"喷雾瓶",material:"塑料",source:"vision"}`，约 15–18 秒出三方案；压缩到 512/q70（约 7KB）后仍能识别。**照片会发给第三方模型服务（阿里云 MaaS）**，首页能力状态行已明确写出「照片会发给模型看图判断物品与材质」。要关闭用 `UPCYCLE_VISION=false npm run deploy:live`；关闭后 `recognized` 只来自填写信息，不会假装识图。视觉测试图 `scripts/fixtures/vision-bottle.jpg` 取自 Wikimedia Commons，仅用于验证、不发布。**2026-11-07 补第二张**带印刷标签的实物图 `scripts/fixtures/vision-shampoo.jpg`（同样仅验证）：用与 `public/app.js` 一致的 Canvas 压缩算法在真实浏览器里压到 683×1024 / q0.82 / 59,687 字符，`POST /api/ocr` 1.5 秒读到 10 行标签文字，`POST /api/ideas` 17.2 秒返回 `recognized={item:"多芬洗发水瓶",material:"塑料",source:"vision"}` 且三款全可行；把 OCR 文字线索一起交给模型再跑一次是 28.4 秒，命名变成英文、三款方案全换——**OCR 线索会显著影响模型输出**，不是 bug。原始响应在 `output/verify/upcycle-second-*.json`；面向外部用户的详细使用报告见 `output/万物改造局-使用说明书.md`，线上首页截图 `output/manual-home.png`。

**默认域名的限制**：CloudBase 测试域名首次访问会出现「风险提醒」中间页，需等 3 秒并点一次「确定访问」；去掉需绑定自定义域名。该环境套餐的自定义域名配额是 `limit 1`，现在由 `case.evansong.cn` 占用，`stock-review.evansong.cn` 已解绑并停止服务。

**已切换到 `case.evansong.cn`（2026-11-07 17:55 完成）**：已把默认域名换成 `case.evansong.cn`：根路径放产品门户页（欢迎使用 Evan Song 的在线产品 + 列表），股票复盘工作台挪到 `case.evansong.cn/stock-review/`，万物改造局保持 `case.evansong.cn/upcycle/`。按「先解绑旧域名再绑新域名」执行完毕（零成本，切换时有短时 downtime）；旧域名已分享/收藏的链接随之失效，配额 `limit 1` 不允许双域名并存做 301。`evansong.cn` 的 DNS 托管在阿里云，三条解析记录已由 ego-browser 添加并逐条验真。

| 前置项 | 状态 |
| --- | --- |
| 阿里云 TXT `_cloudbase-challenge.case` = `evansongdev-d3gwank9e76835e8b` | 已生效（递归 / 223.5.5.5 / dns27 / dns28 四路验真） |
| 阿里云 CNAME `case` → `case.evansong.cn.tcbaccess.tencentcloudbase.com` | 已生效，目标解析到 `124.223.146.214` / `124.223.148.238`（与现有域名同 IP） |
| 阿里云 TXT `_dnsauth.case`（免费证书 DNS 验证值） | 已生效，证书已签发；保留供续期 |
| SSL 证书 `case.evansong.cn` | **已颁发**，`CertificateId=cBMkYW1Y`，TrustAsia DV，2026-11-07 → **2027-02-05**（3 个月，需续期） |
| 云函数 CORS 白名单 | 已放行 `https://case.evansong.cn`、`https://stock-review.evansong.cn`、`https://wanwu.evansong.cn` |
| 门户页 `portal/index.html` | **橱窗版**：按 `evansong.cn` 主站「暖夜星河」科技风重做（深空底 + 60px 网格 + 玻璃卡 + 赛博蓝/极光紫/翡翠青流动渐变），3 列卡片网格 + 分类筛选 + 内联 SVG 图标 + 仓库角标。8 项产品（6 站外按用户顺序 + 2 本站）仍是 `PRODUCTS` 单一真源，描述/分类/仓库对齐主站 `projects.js` 真实数据；站外新窗口 `↗` + `noopener noreferrer`，站内同窗口。本地 39/39、390px 真视口无横向溢出、线上渲染 8 卡片；已覆盖静态托管根 `index.html`，`https://case.evansong.cn/` 远端 md5 逐字节一致；临时预览文件已删 |
| 股票复盘子页 `portal/stock-review/index.html` | 已上线 `https://case.evansong.cn/stock-review/`；修好相对 SDK 路径、og 图硬编码旧域名、`og:url`；原页备份在 `output/backup/stock-review-root.original.html` |

**切换执行记录（2026-11-07 17:55，一次做完）**：门户页覆盖静态托管根 `index.html`（远端 md5 逐字节一致、无 `--prune`）→ 删旧域名 4 条专属路由 → 解绑 `stock-review.evansong.cn` → 用 `CertId=cBMkYW1Y` 绑定 `case.evansong.cn` → 逐条补回 `/`、`/auth-proxy`、`/ocr-proxy`、`/pg` 路由 → 全链路验真 → 删除临时 `portal-preview.html`。回滚依据保存在 `output/backup/domains-before-case.json`、`routes-before-case.json`。

**唯一故障与处理**：绑定成功后约 3 分钟网关仍下发默认 `*.tcloudbase.com` 证书，curl 报 `SSL: no alternative certificate subject name matches`。先用 `-k` 分离验证，确认页面/接口/资源全 200（路由与业务无问题）；证书状态与旧证书完全一致（`Status=1 / Deployable=True`）、两个网关 IP 表现相同 → 判定证书同步延迟而非配置错误；`tcb domains edit case.evansong.cn --certid cBMkYW1Y` 幂等重应用后立即恢复 `TLS=0`、`CN=case.evansong.cn`。**新绑自定义域名后必须复测 TLS SNI，不能只看 `domains ls` 的 SUCCESS**。

**切换后验真**：页面与静态资源全 200；`/api/config` = `mode=live / vision=true / qwen3.8-flash / ocr=true`；真 OCR POST 200 / 330ms / `source=ocr`；`UPCYCLE_URL=https://case.evansong.cn/upcycle/ npm run verify:cloudbase` **12/12 通过**（含跨域真实模型三方案、分享卡、无 CORS 错误、375px 无溢出、无风险提醒）；三条代理路由分别返回业务级 400 `unknown_action` / 400 `missing_image` / 401 `MISSING_CREDENTIALS`；浏览器渲染门户 8 卡片、两个子页标题正确。完整经验教训、可优化项与遗留清单见 `验证记录.md` 最后一节。

早期曾探过 `wanwu.evansong.cn`：`tcb domains add` 预检报配额 `limit 1` + 需加 TXT `_cloudbase-challenge.wanwu`；等价的静态托管通道 `CreateHostingDomain` 返回 `ResourceUnavailable: 静态托管域名不支持绑定，请通过HTTP访问服务绑定域名`，不是配额旁路。该方案已由用户改为 `case.evansong.cn`。

**现在就能用、无风险提醒的地址**：`https://case.evansong.cn/upcycle/`。实测页面、`app.js`、`/upcycle/api/config` 均 200；`UPCYCLE_URL=https://case.evansong.cn/upcycle/ npm run verify:cloudbase` **12/12 通过**，日志明确「测试域名中间页：未出现」，浏览器徽标「已连接模型 · 视觉已启用」。`tcb routes list` 显示该域名 `/` → `STATIC_STORE`，`*` 域名 `/upcycle/api` → SCF，该路径也能同源调接口。已用 `UPCYCLE_URL` 指向新域名重跑浏览器端到端回归，12/12 通过。

**未采用 CloudRun**：`tcb cloudrun deploy` 返回 `CreateCloudRunServer 云托管资源未开通`；该环境是包年包月（prepayment），云托管需在控制台首次开通，因此改用静态托管 + HTTP 云函数。

`server.js` 支持 `HOST` 环境变量（默认仍 `127.0.0.1`），仅为将来容器化部署预留，本地预览行为不变。
