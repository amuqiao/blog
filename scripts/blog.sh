#!/usr/bin/env bash
# 日常 Hugo 博客动作。本地预览服务以前台方式运行，
# 并依赖 Hugo 自带的监听与热重载。

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
HUGO_BIND="${HUGO_BIND:-127.0.0.1}"
HUGO_PORT="${HUGO_PORT:-1313}"

cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
用法:
  ./run.sh blog <action> [args]

动作:
  dev       检查端口后，前台启动本地 Hugo 预览服务，支持热重载。
  stop      停止当前项目的本地 Hugo 预览服务。
  build     构建静态站点到 public/。
  verify    运行发布前最小验证。
  new-post  创建新的文章页面包。
  gif       将 HTML 动画截图导出为 GIF。
  cover     根据文章 slug 调用 OpenAI Image API 生成 cover.png。

日常复制:
  # 前台启动本地预览服务。默认访问：http://localhost:1313/blog/。
  ./run.sh up

  # 换端口启动本地预览服务。
  HUGO_PORT=1314 ./run.sh up

  # 找不到旧终端时，停止当前项目的本地预览服务。
  ./run.sh down

  # 停止自定义端口上的本地预览服务。
  HUGO_PORT=1314 ./run.sh down

  # 构建静态站点到 public/。
  ./run.sh blog build

  # 发布前验证。
  ./run.sh blog verify

  # 创建 content/posts/my-note/index.md。
  ./run.sh blog new-post my-note

  # 将 HTML 动画导出为 GIF；static/posts/<slug>/x.html 默认输出到 content/posts/<slug>/cover.gif。
  ./run.sh blog gif static/posts/pelican-bicycle-two-step-test/opus-5-high-2d.html

  # 根据文章内容生成封面；需要环境变量 OPENAI_API_KEY。
  ./run.sh blog cover my-note

细节:
  dev       执行：hugo server -D --bind "$HUGO_BIND" --port "$HUGO_PORT" --baseURL "$(preview_url)" --appendPort=false --renderToMemory --disableFastRender --noHTTPCache
            监听 content/config/static/assets 变化，并触发浏览器热重载。
            这不是后台常驻服务。停止时在当前终端按 Ctrl+C。
            如果当前项目已在目标端口运行，会提示已运行并成功退出。
            如果端口被其他进程占用，会打印占用进程并退出，不会自动换端口或杀进程。
  stop      只停止当前项目根目录下的 Hugo 预览服务。
            如果目标端口没有当前项目服务，会说明原因并退出。
  build     执行：hugo --gc --minify
  verify    执行：hugo --gc --minify
  new-post  执行：hugo new content posts/<slug>/index.md
            <slug> 不能包含 /、.. 或空白字符。
  gif       执行：node scripts/gif/capture.mjs <input.html> [output.gif]
            依赖 Node、Playwright、Google Chrome 和 gifski。首次使用前运行 npm install。
            默认参数：--duration 4 --fps 15 --width 900 --height 594 --selector body --browser chrome --clock auto
            auto 会为 RAF/performance.now 动画选择 virtual，其他动画走 realtime；也可手动传 --clock。
  cover     执行：node scripts/cover/generate.mjs <slug> [options]
            两段生成：先让文本模型把文章信息写成图片提示词，再交给生图模型出图。
            若 static/posts/<slug>/ 下有 HTML 交互页，会一并抽取其标题层级与每节
            导语作为输入；这类文章的正文真源在交互页里，index.md 只有导语和 iframe。
            默认产出 content/posts/<slug>/cover.png，同目录 cover-prompt.txt
            记录本次提示词与全部模型参数，便于复现。
            风格预设放在可插拔的 scripts/cover/styles.json，增删改不需要动代码；
            --style <name> 用预设，--style-text 临时指定，都不传则由文本模型自选。
            依赖 Node.js 20+、npm install 和环境变量 OPENAI_API_KEY。
            常用参数：--style list --style flat-vector --style-text "画风描述"
                      --prompt "补充要求" --quality high --out <path> --json --force --dry-run
EOF
}

require_hugo() {
  if ! command -v hugo >/dev/null 2>&1; then
    echo "错误：hugo 未安装，或不在 PATH 中。" >&2
    exit 127
  fi
}

require_lsof() {
  if ! command -v lsof >/dev/null 2>&1; then
    echo "错误：无法进行端口预检，必需命令不在 PATH 中：lsof" >&2
    exit 127
  fi
}

require_command() {
  name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "错误：必需命令不在 PATH 中：$name" >&2
    exit 127
  fi
}

preview_url() {
  host="$HUGO_BIND"
  if [[ "$host" == "127.0.0.1" || "$host" == "0.0.0.0" ]]; then
    host="localhost"
  fi

  printf "http://%s:%s/blog/" "$host" "$HUGO_PORT"
}

validate_hugo_port() {
  if [[ ! "$HUGO_PORT" =~ ^[0-9]+$ ]]; then
    echo "错误：HUGO_PORT 必须是 1 到 65535 之间的数字：$HUGO_PORT" >&2
    exit 2
  fi

  hugo_port_number=$((10#$HUGO_PORT))
  if (( hugo_port_number < 1 || hugo_port_number > 65535 )); then
    echo "错误：HUGO_PORT 必须是 1 到 65535 之间的数字：$HUGO_PORT" >&2
    exit 2
  fi
}

load_preview_port_owner() {
  require_lsof

  port_owner=""
  port_owner_fields=""
  lsof_status=0
  owner_pid=""
  owner_command=""
  owner_cwd=""

  set +e
  port_owner="$(lsof -nP -iTCP:"$HUGO_PORT" -sTCP:LISTEN 2>&1)"
  port_owner_fields="$(lsof -nP -iTCP:"$HUGO_PORT" -sTCP:LISTEN -Fpc 2>&1)"
  lsof_status="$?"
  set -e

  if [[ "$lsof_status" -eq 0 ]]; then
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

    if [[ -z "$owner_pid" || -z "$owner_command" ]]; then
      return
    fi

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
}

owner_is_current_project_hugo() {
  [[ -n "$owner_pid" && "$owner_command" == "hugo" && "$owner_cwd" == "$ROOT_DIR" ]]
}

ensure_preview_port_available() {
  validate_hugo_port
  load_preview_port_owner

  if [[ "$lsof_status" -eq 0 ]]; then
    if [[ -z "$owner_pid" || -z "$owner_command" ]]; then
      echo "错误：端口已被占用，但无法识别占用进程。" >&2
      echo "$port_owner" >&2
      exit 1
    fi

    if owner_is_current_project_hugo; then
      echo "本地预览服务已在运行（单例）：$(preview_url)"
      echo "占用进程：PID ${owner_pid}，目录 ${owner_cwd}"
      echo "停止方式：在旧服务所在终端按 Ctrl+C。"
      exit 0
    fi

    echo "错误：本地预览端口已被占用：${HUGO_BIND}:${HUGO_PORT}" >&2
    echo >&2
    echo "$port_owner" >&2
    echo >&2
    echo "处理方式：" >&2
    echo "  1. 直接打开已有服务：http://localhost:${HUGO_PORT}/blog/" >&2
    echo "  2. 在旧服务所在终端按 Ctrl+C 停止后重试。" >&2
    if (( hugo_port_number < 65535 )); then
      echo "  3. 临时换端口：HUGO_PORT=$((hugo_port_number + 1)) ./run.sh blog dev" >&2
    fi
    echo "  4. 查看当前端口占用：./run.sh doctor port ${HUGO_PORT}" >&2
    exit 1
  elif [[ "$lsof_status" -gt 1 ]]; then
    echo "错误：端口预检失败。" >&2
    echo "$port_owner" >&2
    exit "$lsof_status"
  fi
}

stop_preview_service() {
  validate_hugo_port
  load_preview_port_owner

  if [[ "$lsof_status" -eq 1 ]]; then
    echo "本地预览服务未运行：$(preview_url)"
    return 0
  elif [[ "$lsof_status" -gt 1 ]]; then
    echo "错误：端口检查失败，未停止任何进程。" >&2
    echo "$port_owner" >&2
    exit "$lsof_status"
  fi

  if [[ -z "$owner_pid" || -z "$owner_command" ]]; then
    echo "错误：端口已被占用，但无法识别占用进程；未停止任何进程。" >&2
    echo "$port_owner" >&2
    exit 1
  fi

  if ! owner_is_current_project_hugo; then
    echo "错误：目标端口不是当前项目的 Hugo 预览服务，拒绝停止。" >&2
    echo >&2
    echo "$port_owner" >&2
    if [[ -n "$owner_cwd" ]]; then
      echo "占用进程目录：${owner_cwd}" >&2
    fi
    exit 1
  fi

  echo "正在停止本地预览服务：PID ${owner_pid}，$(preview_url)"
  if ! kill "$owner_pid"; then
    echo "错误：发送停止信号失败：PID ${owner_pid}" >&2
    exit 1
  fi

  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
    if ! kill -0 "$owner_pid" >/dev/null 2>&1; then
      echo "本地预览服务已停止。"
      return 0
    fi
    sleep 0.1
  done

  echo "错误：已发送停止信号，但进程仍在运行：PID ${owner_pid}" >&2
  exit 1
}

action="${1:-}"

case "$action" in
  -h|--help|help)
    usage
    ;;
  dev)
    shift
    require_hugo
    ensure_preview_port_available
    exec hugo server -D --bind "$HUGO_BIND" --port "$HUGO_PORT" --baseURL "$(preview_url)" --appendPort=false --renderToMemory --disableFastRender --noHTTPCache "$@"
    ;;
  stop)
    shift
    stop_preview_service
    ;;
  build)
    shift
    require_hugo
    exec hugo --gc --minify "$@"
    ;;
  verify)
    shift
    require_hugo
    hugo --gc --minify "$@"
    ;;
  new-post)
    shift
    slug="${1:-}"
    if [[ -z "$slug" ]]; then
      echo "错误：缺少文章 slug。" >&2
      exit 2
    fi
    if [[ "$slug" == *"/"* || "$slug" == *".."* || "$slug" =~ [[:space:]] ]]; then
      echo "错误：文章 slug 不能包含 /、.. 或空白字符。" >&2
      exit 2
    fi
    shift
    exec hugo new content "posts/$slug/index.md" "$@"
    ;;
  gif)
    shift
    case "${1:-}" in
      -h|--help|help)
        exec node "$ROOT_DIR/scripts/gif/capture.mjs" --help
        ;;
    esac
    require_command node
    require_command gifski
    exec node "$ROOT_DIR/scripts/gif/capture.mjs" "$@"
    ;;
  cover)
    shift
    require_command node
    exec node "$ROOT_DIR/scripts/cover/generate.mjs" "$@"
    ;;
  "")
    usage >&2
    exit 2
    ;;
  *)
    usage >&2
    echo "错误：未知 blog 动作：$action" >&2
    exit 2
    ;;
esac
