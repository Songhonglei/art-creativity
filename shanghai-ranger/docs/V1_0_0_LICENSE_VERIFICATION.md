# v1.0.0 非商业许可构建核验

2026-11-10。许可变更源码提交`e9f8bf0`；玩法及界面代码未改。本轮将自有内容改为PolyForm Noncommercial 1.0.0，第三方字体和依赖原许可保留；历史版本授权不追溯撤销。

- LICENSE为官方未修改原文，NOTICE保留Required Notice；package和lock根声明一致。
- H5与IIFE构建通过；新增`project-license.json`完整携带许可原文和版权声明，两产物均已逐字核验。
- 新ZIP共44文件，与dist-tool逐字节一致；旧收尾包43个文件散列全部不变，仅新增许可JSON。
- 目录审计及ZIP体积审计均0警告；Vite既有大chunk提示保留。未重复运行不受影响的玩法测试；245项为收尾轮历史结果，不是本次新跑。
- 未进行平台上传、真机验证或游戏功能PR合并；构建通过不等于平台／真机通过。

当前含许可包：`output/沪上游侠-v1.0.0-小红书小工具-非商业许可.zip`，1898422字节，SHA256 `426c8093e77b14c82f972f4806599f9f4db72c54b27714e6dd43567bf5b73056`。

原字体A、收尾包及旧验收记录保留。后续验证Agent默认从GitHub源码自行构建，并记录自己的提交、ZIP及散列，不能沿用历史包身份。核验清单见[build-manifest.json](evidence/v1.0.0-license/build-manifest.json)。
