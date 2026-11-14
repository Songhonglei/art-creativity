# 发给验证 Agent 的启动指令

以下整段可直接发送，支持从GitHub下载源码后自行打包：

```text
请按以下GitHub验证方案执行，使用修订3（65项用例，含源码下载和打包步骤）：
https://github.com/Songhonglei/art-creativity/blob/feature/shanghai-ranger-v1.0.0/shanghai-ranger/docs/validation-handoff-20261110/PLAN.md

从 https://github.com/Songhonglei/art-creativity 下载 feature/shanghai-ranger-v1.0.0 分支，项目在 shanghai-ranger/ 子目录；不要下载main当作本次v1.0.0。读下载副本的AGENTS.md、CURRENT-STATUS.md、最新收尾验收和验证方案，锁定实际完整提交，使用新目录自行打包；不依赖作者电脑的路径或本机历史ZIP。

按方案第1.1–1.2节准备Git/Bash/Python3/zip和Node 22.16+（建议Node22），运行npm ci、npm run assets:check、npm test、npm run build，再通过仓库内置scripts/minitool和scripts/build-tool.sh生成离线ZIP。保存构建日志，核对ZIP与dist-tool逐文件一致，生成本轮artifact.json记录实际源码提交、工具版本、包大小、SHA256和文件散列。历史ZIP散列只是参考，不要求新构建ZIP字节相同，也不能把历史通过结果搬到新包。

本次授权准备官方Android和iOS模拟器环境、下载源码并安装构建依赖和打包，完成小红书小工具平台模拟器、Android模拟器、iOS模拟器验证，并组织Android／iPhone真实小红书客户端实测；可执行必要的测试上传及生成预览，不提交审核、不正式发布、不覆盖真实玩家存档。免费本地工具正常安装，收费资源另行说明。应用缺陷先报告，业务代码修复按我的后续指令处理。

使用本轮同一ZIP贯穿平台与手机验证，系统浏览器预览也从这份ZIP解压。iOS模拟器只承担Safari兼容性，不能代替iPhone小红书容器。重点补验坏档恢复、独立存储槽与回滚、超时写入、宠物滑动、矮屏／焦点、夜数、自动画质、分步街区、暂停绘制和缓存回收；固定画质对照关闭自动调节。缺旧内核、手机或无法量化时如实记录阻塞，不用mock、改UA或模拟器帧率代替真机证据。

常规可逆步骤直接推进；缺账号、作品或手机时集中询问，等待时继续其他可执行项目。每个用例×环境单独记录状态和证据，结果保存在本轮项目目录 docs/evidence/platform-validation/<北京时间轮次>/，交付REPORT.md、问题清单、artifact.json、构建日志及实际测试ZIP路径。环境就绪、打包成功、扫码成功与验收通过分别报告。
```

完整方案见 [PLAN.md](PLAN.md)。历史作者包与核验回执仅用于追溯；本文件不表示已执行构建或平台验证。
