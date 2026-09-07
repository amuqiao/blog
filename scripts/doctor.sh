#!/usr/bin/env bash
# Hugo + Blowfish 博客排障检查。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
HUGO_PORT="${HUGO_PORT:-1313}"

cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
用法:
  ./run.sh doctor <action> [args]

常用入口:
  ./run.sh up      启动本地预览
  ./run.sh down    停止本地预览
  ./run.sh -h      查看常用命令

动作:
  env          检查本地 Hugo 命令和 extended 版本支持。
  theme        检查 Blowfish submodule 和主题目录。
  content-map  检查文章/demo slug 映射和 .data 引用。
  port         检查本地预览端口是否被占用。
  build        用更严格的参数构建，用于排查路径问题。
  all          依次运行 env、theme、content-map 和 build。

排障复制:
  ./run.sh doctor env            # 检查 Hugo 和 extended 版
  ./run.sh doctor theme          # 检查 Blowfish submodule
  ./run.sh doctor content-map    # 检查文章/demo 映射和 .data 引用
  ./run.sh doctor port           # 检查默认端口
  ./run.sh doctor port 1314      # 检查指定端口
  ./run.sh doctor build          # 严格构建
  ./run.sh doctor all            # 完整排障

细节:
  env          打印 Hugo 版本；如果不是 extended 版则失败。
  theme        打印 themes/blowfish 的 git submodule 状态，并检查主题目录。
  content-map  列出文章页面包，检查 static/posts/<slug>/ 是否有对应文章，
               如果发布路径引用 .data 则失败。
  port         使用 HUGO_PORT，默认检查 1313；也可以传入端口号。
               如果端口被当前项目的 Hugo 占用，视为单例预览服务已运行。
  build        执行：hugo --cleanDestinationDir --gc --minify --printPathWarnings
EOF
}

require_command() {
  name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "错误：必需命令不在 PATH 中：$name" >&2
    exit 127
  fi
}

check_env() {
  require_command hugo
  version="$(hugo version)"
  echo "$version"
  if [[ "$version" != *"+extended"* ]]; then
    echo "错误：Blowfish 需要 Hugo extended 版。" >&2
    exit 1
  fi
}

check_theme() {
  require_command git
  if [[ ! -d "$ROOT_DIR/themes/blowfish" ]]; then
    echo "错误：缺少主题目录：themes/blowfish" >&2
    exit 1
  fi
  git submodule status --recursive themes/blowfish
  echo "主题：themes/blowfish 存在"
}

check_content_map() {
  require_command rg
  failed=0

  echo "文章页面包："
  if compgen -G "content/posts/*/index.md" >/dev/null; then
    for index_file in content/posts/*/index.md; do
      slug="${index_file#content/posts/}"
      slug="${slug%/index.md}"
      if [[ -d "static/posts/$slug" ]]; then
        echo "  正常  $slug -> static/posts/$slug/"
      else
        echo "  正常  $slug -> 无 static demo 目录"
      fi
    done
  else
    echo "  未找到文章页面包。"
  fi

  if [[ -d "static/posts" ]]; then
    for static_dir in static/posts/*; do
      [[ -d "$static_dir" ]] || continue
      slug="${static_dir#static/posts/}"
      if [[ ! -f "content/posts/$slug/index.md" ]]; then
        echo "错误：静态 demo 目录没有对应文章页面包：$static_dir" >&2
        failed=1
      fi
    done
  fi

  set +e
  rg -n -F ".data" content static config
  rg_status="$?"
  set -e

  if [[ "$rg_status" -eq 0 ]]; then
    echo "错误：Hugo 发布路径不能引用 .data。" >&2
    failed=1
  elif [[ "$rg_status" -gt 1 ]]; then
    echo "错误：扫描 Hugo 发布路径中的 .data 引用失败。" >&2
    exit "$rg_status"
  fi

  if [[ "$failed" -ne 0 ]]; then
    exit "$failed"
  fi
}

check_build() {
  require_command hugo
  hugo --cleanDestinationDir --gc --minify --printPathWarnings "$@"
}

check_port() {
  require_command lsof

  port="${1:-$HUGO_PORT}"
  if [[ ! "$port" =~ ^[0-9]+$ ]]; then
    echo "错误：端口必须是 1 到 65535 之间的数字：$port" >&2
    exit 2
  fi

  port_number=$((10#$port))
  if (( port_number < 1 || port_number > 65535 )); then
    echo "错误：端口必须是 1 到 65535 之间的数字：$port" >&2
    exit 2
  fi

  set +e
  port_owner="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>&1)"
  port_owner_fields="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -Fpc 2>&1)"
  lsof_status="$?"
  set -e

  if [[ "$lsof_status" -eq 0 ]]; then
    owner_pid=""
    owner_command=""
    while IFS= read -r line; do
      case "$line" in
        p*)
          if [[ -z "$owner_pid" ]]; then
            owner_pid="${line#p}"
          fi
          ;;
        c*)
          if [[ -z "$owner_command" ]]; then
            owner_command="${line#c}"
          fi
          ;;
      esac
    done <<< "$port_owner_fields"

    owner_cwd=""
    if [[ -n "$owner_pid" ]]; then
      set +e
      owner_cwd_fields="$(lsof -a -p "$owner_pid" -d cwd -Fn 2>&1)"
      owner_cwd_status="$?"
      set -e

      if [[ "$owner_cwd_status" -eq 0 ]]; then
        while IFS= read -r line; do
          case "$line" in
            n*)
              owner_cwd="${line#n}"
              break
              ;;
          esac
        done <<< "$owner_cwd_fields"
      fi
    fi

    if [[ "$owner_command" == "hugo" && "$owner_cwd" == "$ROOT_DIR" ]]; then
    echo "端口 ${port} 已被当前项目的 Hugo 预览服务占用，单例服务已运行："
    echo "访问地址：http://localhost:${port}/blog/"
    echo "占用进程：PID ${owner_pid}，目录 ${owner_cwd}"
      return 0
    fi

    echo "端口 ${port} 已被其他进程占用："
    echo "$port_owner"
    exit 1
  elif [[ "$lsof_status" -eq 1 ]]; then
    echo "端口 ${port} 未被占用。"
  else
    echo "错误：端口检查失败。" >&2
    echo "$port_owner" >&2
    exit "$lsof_status"
  fi
}

action="${1:-}"

case "$action" in
  -h|--help|help)
    usage
    ;;
  env)
    check_env
    ;;
  theme)
    check_theme
    ;;
  content-map)
    check_content_map
    ;;
  port)
    shift
    check_port "$@"
    ;;
  build)
    shift
    check_build "$@"
    ;;
  all)
    shift
    check_env
    check_theme
    check_content_map
    check_build "$@"
    ;;
  "")
    usage >&2
    exit 2
    ;;
  *)
    usage >&2
    echo "错误：未知 doctor 动作：$action" >&2
    exit 2
    ;;
esac
