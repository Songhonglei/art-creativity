# 当前状态

证据日期：2026-11-10。本文件为v1.0.0隔离工作树导航，不代表线上或小红书平台发布。

- 许可已更新为PolyForm Noncommercial 1.0.0；自有内容非商业用途免费，超出许可范围的商用须另获书面授权。新增`public/project-license.json`随H5／离线包复制，历史收尾包和原核验记录保留；新包须重新记录散列，不能沿用43文件旧包的通过结论。

- 当前版本 **v1.0.0**，分支 `feature/v1.0.0-hero-ui`；应用代码提交 `83dc188`。
- [需求与详细方案](docs/V1_0_0_REQUIREMENTS_AND_DESIGN_DRAFT.md)已获批准并实施；[验收报告](docs/V1_0_0_VERIFICATION.md)逐项记录32条需求、228项测试、六种视口、触控、两生产包与未完成的平台检查。
- 六套主角模型、4/7/10免费外观、10级侠义（战力封顶5级）、同页男女选择、棕色长马尾和大眼、全UI与真实衣橱已交付。
- 用户已确认字体A「得意黑」并实施；[字体修订验收](docs/V1_0_0_FONT_A_VERIFICATION.md)与[最新构建清单](docs/evidence/v1.0.0-font-a/build-manifest.json)记录本轮结果。该轮包为 `output/沪上游侠-v1.0.0-小红书小工具-字体A.zip`；原包与历史验收保留。
- 包含v0.9.5死亡恢复，基线53文件与旧正式验收散列一致；原工作区 `/Users/songhonglei/space/沪上游侠` 的v0.9.5应用源码未修改。
- 小红书模拟器、Android/iOS真机及实际Chrome61仍待验证，不能由浏览器模拟或host mock推断通过。
- 综合审查R01–R08、O01–O03与9项性能实施已完成，本地验收见[收尾验收](docs/V1_0_0_CLOSEOUT_VERIFICATION.md)。245项测试、六尺寸两包84状态与故障恢复检查通过；核心调用降低25%的建议目标未达，真机与长时性能仍待测。
- 当前含许可离线包为 `output/沪上游侠-v1.0.0-小红书小工具-非商业许可.zip`（1898422字节，44文件），见[许可构建核验](docs/V1_0_0_LICENSE_VERIFICATION.md)。旧收尾包与字体A包保留；新包未提交平台。

- [平台与设备验证方案](docs/validation-handoff-20261110/PLAN.md)已更新至修订3，含65项用例及[接手指令](docs/validation-handoff-20261110/START-HERE.md)；默认从GitHub分支下载源码，使用仓库内置Builder自行打包并生成本轮artifact.json，不依赖作者本机ZIP。[历史包核验](docs/validation-handoff-20261110/PACKAGE-CHECK.json)仅供追溯。方案不代表平台或真机已通过。

[README](README.md)提供操作与构建命令；[v0.9.5历史验收](docs/V0_9_5_VERIFICATION.md)、[宠物美术历史验收](docs/PET_VISUAL_REVISION_2026_11_10.md)保留。资料索引说明见[OPENVIKING](docs/OPENVIKING.md)，注册工作区仍为原目录，不自动将本隔离工作树注册或扩展白名单。
