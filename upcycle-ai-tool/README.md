# 万物改造局 · Upcycle AI Tool

上传一张闲置物照片，生成**实用款 / 好看款 / 脑洞款**三种可动手制作的改造方案；可按手头工具与预算追加限制，并导出制作清单与分享卡。

原生 HTML / CSS / JavaScript + Node.js 原生 HTTP 服务，零第三方依赖、无构建步骤。源码收录于 [Songhonglei/art-creativity](https://github.com/Songhonglei/art-creativity) 的 `upcycle-ai-tool/`，各项目相互独立。

在线体验：<https://case.evansong.cn/upcycle/>

## 本地运行

需要 Node.js >= 18。

```bash
git clone https://github.com/Songhonglei/art-creativity.git
cd art-creativity/upcycle-ai-tool/app
npm start
```

浏览器打开 <http://127.0.0.1:4173/>。服务只监听本机，不对外暴露。

不配置任何环境变量时自动进入**示例模式**：使用内置规则数据并明确标注「示例方案」，不调用模型、不做图像识别。需要接入模型时，把 `app/.env.example` 复制为 `app/.env` 并填写 `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`；密钥只留在服务端，不会下发到浏览器。`.env` 已被忽略。

## 目录

| 路径 | 内容 |
| --- | --- |
| `app/public/` | 前端页面、样式、图标与分享卡逻辑 |
| `app/server.js` | 本地 HTTP 服务与接口路由 |
| `app/lib/` | 方案编排、模型调用、图像与规则数据 |
| `app/scripts/` | 构建、部署与验收脚本 |
| `app/cloudbase/` | 云函数入口与 CloudBase 配置 |

`app/README.md` 有完整的运行模式与接口说明。

本目录只收录可公开的成品源码；发布文案、设计素材、验收截图与部署产物保留在私有项目中，不随仓库发布。线上橱窗与案例页源码见私有仓库 `evanhomepage` 的 `case/`。

## 许可

自有代码及随软件提供的原创内容采用 [PolyForm Noncommercial 1.0.0](LICENSE)。这是源码公开的非商业许可，不属于 OSI 定义的开源许可。第三方依赖、字体和素材保留各自许可。详见仓库根目录 [LICENSING.md](../LICENSING.md) 与 [NOTICE](NOTICE)。
