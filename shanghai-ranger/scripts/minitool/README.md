# 离线构建审计

`audit_artifact.mjs`、`write_manifest.mjs`来自本机webapp-building-pro 1.2.0的小工具Builder，2026-11-10快照，均为零第三方依赖脚本。供CI与本地使用，随源码保留，不进入小工具ZIP；平台能力仍需最终宿主验证。

上游：`webapp-building-pro/modules/xiaohongshu-minitool/builder/scripts/`。更新时核对平台契约、比对脚本，再运行目录及ZIP审计。`MINITOOL_BUILDER_DIR`可显式指定替代工具；默认使用本仓库快照，避免CI依赖个人Skill路径。
