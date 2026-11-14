# 项目知识库

证据日期：2026-11-10。

项目 `shanghai-ranger` 复用本机全局 `openviking` MCP 与 loopback 服务 `http://127.0.0.1:1933`，资料存放在 `~/.openviking-pilot/projects/shanghai-ranger/`。使用项目独立账号；MCP 路由与原生账号是两层边界。

## 白名单

1. `CURRENT-STATUS.md`：当前状态和资料优先级。
2. `README.md`：运行入口、模块和现有规则。
3. `docs/V0_9_0_REQUIREMENTS_AND_ACCEPTANCE.md`：v0.9.0 需求。
4. `docs/V0_9_0_VERIFICATION.md`：v0.9.0 历史验收。
5. `docs/PET_GAMEPLAY_V3_2026_11_10.md`：宠物 V3 设计。
6. `docs/PET_VISUAL_REVISION_2026_11_10.md`：美术修订要求与该轮验收结果。
7. `docs/V0_9_5_REQUIREMENTS_AND_ACCEPTANCE.md`：实施中的死亡恢复方案。
8. `docs/OPENVIKING.md`：本维护说明。

其余内容不自动入库。来源策略还会生成一份资料边界说明。manifest 记录来源、选区、证据日期与 SHA256；导入回执逐份核验服务端原文，不把生成摘要当作权威来源。

## 维护

沿用已有管理入口，不重新安装或替换共用服务：

```sh
~/.openviking-pilot/venv/bin/python3 ~/.openviking-pilot/scripts/project.py shanghai-ranger status
~/.openviking-pilot/venv/bin/python3 ~/.openviking-pilot/scripts/project.py shanghai-ranger sync --dry-run
~/.openviking-pilot/venv/bin/python3 ~/.openviking-pilot/scripts/project.py shanghai-ranger sync
```

先审阅 dry-run；正常增量每轮最多五份变更，首次建库除外。无变化返回 `unchanged`，不新建模型任务。运行中跟进原任务，未知提交先核对 journal，不重复导入。本文只描述维护方法，不构成未来任务的操作授权。

本地入口：`configs/pilot-policy.json` 为白名单，`evidence/source-manifest.json` 为来源清单，`evidence/import-receipt.json` 为导入回执；均相对上述项目状态目录。凭据留在本机私有配置中，不写入项目或聊天。

已有全局 MCP 无需重新注册；新聊天可沿用。检索每次提供项目 code 和绝对工作区，来源变化时先同步或查本地。不启用定时同步、自启动、看板或聊天记忆。

## 本机模型与隔离检查

2026-11-10 实际探针：摘要模型 `glm-5.3-flashx` 可访问；`qwen3-embedding-8b` 返回 4096 维向量，与现有配置一致。复用现有公司模型入口与本机凭据，不在项目中复制密钥。

本项目独立账号与已有开发账号分别读取对方原文时均返回 404，原生跨账号读取被拒绝。该结果只说明本机此处的账号检查，不代表其他电脑或操作系统已验收。项目文档被其他任务修改后，MCP 会拒绝回读旧快照；需更新同步，不能用旧摘要继续作结论。
