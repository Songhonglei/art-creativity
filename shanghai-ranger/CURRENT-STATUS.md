# 当前状态

证据日期：2026-11-10。本文件为v1.0.0隔离工作树导航，不代表线上或小红书平台发布。

- 当前版本 **v1.0.0**，分支 `feature/v1.0.0-hero-ui`；应用代码提交 `83dc188`。
- [需求与详细方案](docs/V1_0_0_REQUIREMENTS_AND_DESIGN_DRAFT.md)已获批准并实施；[验收报告](docs/V1_0_0_VERIFICATION.md)逐项记录32条需求、228项测试、六种视口、触控、两生产包与未完成的平台检查。
- 六套主角模型、4/7/10免费外观、10级侠义（战力封顶5级）、同页男女选择、棕色长马尾和大眼、全UI与真实衣橱已交付。
- 用户已确认字体A「得意黑」并实施；[字体修订验收](docs/V1_0_0_FONT_A_VERIFICATION.md)与[最新构建清单](docs/evidence/v1.0.0-font-a/build-manifest.json)记录本轮结果。该轮包为 `output/沪上游侠-v1.0.0-小红书小工具-字体A.zip`；原包与历史验收保留。
- 包含v0.9.5死亡恢复，基线53文件与旧正式验收散列一致；原工作区 `/Users/songhonglei/space/沪上游侠` 的v0.9.5应用源码未修改。
- 小红书模拟器、Android/iOS真机及实际Chrome61仍待验证，不能由浏览器模拟或host mock推断通过。
- 综合审查R01–R08、O01–O03与9项性能实施已完成，本地验收见[收尾验收](docs/V1_0_0_CLOSEOUT_VERIFICATION.md)。245项测试、六尺寸两包84状态与故障恢复检查通过；核心调用降低25%的建议目标未达，真机与长时性能仍待测。
- 最新离线包为 `output/沪上游侠-v1.0.0-小红书小工具-收尾优化.zip`（1896197字节，1.81MiB），旧字体A包保留；新包未提交平台。

[README](README.md)提供操作与构建命令；[v0.9.5历史验收](docs/V0_9_5_VERIFICATION.md)、[宠物美术历史验收](docs/PET_VISUAL_REVISION_2026_11_10.md)保留。资料索引说明见[OPENVIKING](docs/OPENVIKING.md)，注册工作区仍为原目录，不自动将本隔离工作树注册或扩展白名单。
