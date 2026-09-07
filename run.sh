#!/usr/bin/env bash
# Unified entry. Keep orchestration here and mode-specific logic
# in scripts/blog.sh / scripts/doctor.sh so failures are easier to inspect.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

usage() {
  cat <<'EOF'
用法:
  ./run.sh <命令> [参数]
  ./run.sh <模式> <动作> [参数]

预览:
  ./run.sh up                         # 启动本地预览；已运行则显示地址
  ./run.sh down                       # 停止当前项目的本地预览
  HUGO_PORT=1314 ./run.sh up          # 换端口启动
  HUGO_PORT=1314 ./run.sh down        # 停止指定端口

写作:
  ./run.sh blog new-post my-note      # 创建文章页面包

构建:
  ./run.sh blog verify                # 发布前验证
  ./run.sh blog build                 # 构建 public/

排障:
  ./run.sh doctor port                # 检查端口
  ./run.sh doctor port 1314           # 检查指定端口
  ./run.sh doctor all                 # 完整检查

更多:
  ./run.sh blog -h                    # 日常命令详情
  ./run.sh doctor -h                  # 排障命令详情
EOF
}

mode="${1:-}"

case "$mode" in
  -h|--help|help)
    usage
    ;;
  up)
    shift
    case "${1:-}" in
      -h|--help|help)
        exec "$ROOT_DIR/scripts/blog.sh" -h
        ;;
    esac
    exec "$ROOT_DIR/scripts/blog.sh" dev "$@"
    ;;
  down)
    shift
    case "${1:-}" in
      -h|--help|help)
        exec "$ROOT_DIR/scripts/blog.sh" -h
        ;;
    esac
    exec "$ROOT_DIR/scripts/blog.sh" stop "$@"
    ;;
  blog|doctor)
    shift
    exec "$ROOT_DIR/scripts/$mode.sh" "$@"
    ;;
  "")
    usage >&2
    exit 2
    ;;
  *)
    usage >&2
    echo "错误：未知模式：$mode" >&2
    exit 2
    ;;
esac
