#!/usr/bin/env bash
# 小红书小工具（离线 H5）一键打包：IIFE 构建 -> 组包 -> 标记 -> 审计 -> zip
# 用法：bash scripts/build-tool.sh [输出zip路径]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-$(pwd)/output/沪上游侠-小红书小工具.zip}"
OUT="$(python3 -c 'import os,sys;print(os.path.abspath(sys.argv[1]))' "$OUT")"
BUILDER_DIR="${MINITOOL_BUILDER_DIR:-}"
if [[ -z "$BUILDER_DIR" ]]; then
  for candidate in \
    "$(pwd)/scripts/minitool" \
    "$HOME/.codex/skills/webapp-building-pro/modules/xiaohongshu-minitool/builder" \
    "$HOME/.agents/skills/webapp-building-pro/modules/xiaohongshu-minitool/builder" \
    /app/.agents/skills/xiaohongshu-minitool/builder; do
    if [[ -f "$candidate/scripts/write_manifest.mjs" && -f "$candidate/scripts/audit_artifact.mjs" ]]; then
      BUILDER_DIR="$candidate"; break
    fi
  done
fi
for script in write_manifest.mjs audit_artifact.mjs; do
  if [[ ! -f "$BUILDER_DIR/scripts/$script" ]]; then
    echo "缺少 Mini Tool builder：${script}。请将 MINITOOL_BUILDER_DIR 设为 builder 目录后重试。" >&2
    exit 1
  fi
done
mkdir -p "$(dirname "$OUT")"

# 1) IIFE 经典脚本构建（Chrome 61 / ES2017）。临时目录避免某些挂载盘丢失新产物。
TMP_DIST="${TMPDIR:-/tmp}/shanghai-ranger-tool-$$"
rm -rf "$TMP_DIST"
npx vite build --config vite.config.tool.ts --outDir "$TMP_DIST" --emptyOutDir
rm -rf dist-tool && mkdir -p dist-tool
python3 - "$TMP_DIST" "$(pwd)/dist-tool" <<'PY'
import shutil, sys
from pathlib import Path
source, target = Path(sys.argv[1]), Path(sys.argv[2])
for item in source.rglob('*'):
    if item.is_file():
        destination = target / item.relative_to(source)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(item, destination)
PY
rm -rf "$TMP_DIST"
if [[ ! -s dist-tool/app.js || ! -s dist-tool/shanghai-ranger.css ]]; then
  echo "离线构建缺少 app.js 或样式文件，停止打包。" >&2
  exit 1
fi

# 2) 组包：仅允许的文件类型（直接使用工程内 woff2，ttf 容器不允许）
rm -rf dist-tool/fonts dist-tool/original-font
find dist-tool -name '*.ttf' -delete
mkdir -p dist-tool/fonts dist-tool/original-font
cp public/fonts/*.woff2 dist-tool/fonts/
cp public/original-font/*.woff2 dist-tool/original-font/
cp scripts/tool-index.html dist-tool/index.html
python3 - <<'PY'
import json
from pathlib import Path
licenses = {}
for path in sorted(Path('public').rglob('*.txt')):
    licenses[str(path.relative_to('public'))] = path.read_text()
Path('dist-tool/fonts/licenses.json').write_text(json.dumps(licenses, ensure_ascii=False, indent=2) + '\n')
version = json.loads(Path('package.json').read_text())['version']
Path('dist-tool/version.json').write_text(json.dumps({'name': '沪上游侠', 'version': version}, ensure_ascii=False) + '\n')
if f'content="{version}"' not in Path('dist-tool/index.html').read_text():
    raise SystemExit('入口与 package.json 版本不一致，停止打包。')
for path in Path('dist-tool').rglob('.DS_Store'):
    path.unlink()
PY

# 3) 高消耗能力标记（本项目无 Worker / 离屏渲染 / WASM / 游戏引擎，判 false）
node "$BUILDER_DIR/scripts/write_manifest.mjs" ./dist-tool false

# 4) 打包前审计（目录）
node "$BUILDER_DIR/scripts/audit_artifact.mjs" ./dist-tool

# 5) 压缩目录内容本身（index.html 必须在 zip 根）
rm -f "$OUT"
(cd dist-tool && zip -r -q "$OUT" . -x '*.DS_Store')
node "$BUILDER_DIR/scripts/audit_artifact.mjs" "$OUT"
echo "OK -> $OUT"
