#!/usr/bin/env bash
# ============================================================
# 音乐收藏数据刷新脚本
# 1. 从本机 Apple Music 资料库导出歌曲 + 封面（Swift + iTunesLibrary）
# 2. （可选）从 Spotify 拉取爱心收藏（需要 SPOTIFY_* 环境变量）
# 3. 合并去重生成 music.json
# ============================================================
set -e

# 脚本所在目录（utils/music/）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 博客 public 下的输出目录
OUT_DIR="$SCRIPT_DIR/../../docs/.vuepress/public/music"

echo "========================================"
echo " 刷新音乐收藏数据"
echo "========================================"

# 1. 编译 Swift 导出工具（如需）
if [ ! -x "$SCRIPT_DIR/export_apple_music" ]; then
  echo "→ 编译 export_apple_music..."
  swiftc -F "$(xcrun --show-sdk-path)/System/Library/Frameworks" \
    -framework Foundation -framework iTunesLibrary \
    -o "$SCRIPT_DIR/export_apple_music" "$SCRIPT_DIR/export_apple_music.swift"
fi

# 2. 导出 Apple Music 资料库
echo "→ 导出 Apple Music 资料库..."
"$SCRIPT_DIR/export_apple_music" "$OUT_DIR"

# 3. 拉取 Spotify（若配了凭证）
if [ -n "$SPOTIFY_CLIENT_ID" ] && [ -n "$SPOTIFY_CLIENT_SECRET" ] && [ -n "$SPOTIFY_REFRESH_TOKEN" ]; then
  echo "→ 拉取 Spotify 爱心收藏..."
  node "$SCRIPT_DIR/fetch_spotify_liked.js" "$OUT_DIR"
else
  echo "→ 未配置 SPOTIFY_* 环境变量，跳过 Spotify（仅 Apple Music）"
fi

# 4. 合并去重
echo "→ 合并去重..."
node "$SCRIPT_DIR/merge_music.js" "$OUT_DIR"

echo "========================================"
echo " 完成！数据已写入 $OUT_DIR/music.json"
echo "========================================"
