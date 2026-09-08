## Git 规则

- 提交必须保持单一意图，不混入无关改动；跨主题改动应拆分提交。
- 提交前确认改动范围、提交主题、入口文档或规则文件同步情况。
- 提交前完成最小必要验证；无法验证时说明原因和剩余风险。
- 提交信息默认使用中文；无仓库规范时优先使用 Conventional Commits，例如 `docs:`、`feat:`、`fix:`、`refactor:`、`chore:`。
- 提交信息优先写“改了什么”和对象，不写空泛标题。
- 只在用户明确要求时提交；非明确要求下不做 `amend`，不改写历史。

## Hugo 博客资源映射

- 普通文章使用页面包：`content/posts/<post-slug>/index.md`。
- 文章专属图片、PDF、JSON、音频、视频等页面资源，优先放在同一个页面包内：`content/posts/<post-slug>/...`。
- 文章列表/首页卡片封面统一命名为 `cover.*`；文章页 hero 背景统一命名为 `background.*`，让 Blowfish 自动按用途识别。
- 需要原样发布的独立 HTML demo、可直接打开的实验页面、完整前端静态小作品，放在同名静态目录：`static/posts/<post-slug>/...`。
- `content/posts/<post-slug>/` 与 `static/posts/<post-slug>/` 的 `<post-slug>` 必须一致，用 slug 建立一一对应关系。
- 文章引用同名静态目录中的独立 HTML 时，优先使用同级相对路径，例如 `2d.html`、`3d.html`；构建后对应 `/posts/<post-slug>/2d.html`、`/posts/<post-slug>/3d.html`。
- 对“Markdown 摘要 + HTML 交互页”的文章，HTML 是正文和交互真源；Markdown 只保留 front matter、少量导语、入口按钮和 iframe。
- Markdown 不重复维护 HTML 中的完整正文、模块目录或交互说明，避免形成两份笔记。
- 不要在文章或配置中引用 `.data/`；`.data/` 只作为临时输入、截图或外部素材缓存，不属于 Hugo 发布内容。
- 修改文章 slug、permalink、alias 或同名 `content` / `static` 目录后，必须清理旧 slug、旧 alias 和旧站内链接，不保留历史入口；验证站内入口只指向新 slug。

## Hugo 启动入口

- 统一入口是根目录 `./run.sh <mode> <action>`，`run.sh` 只负责 mode 分发。
- 常用简写是 `./run.sh up` 和 `./run.sh down`，分别等价于 `./run.sh blog dev` 和 `./run.sh blog stop`。
- 日常写作、前台预览、构建、验证和建文章走 `./run.sh blog <action>`，实现放在 `scripts/blog.sh`。
- 排障诊断走 `./run.sh doctor <action>`，实现放在 `scripts/doctor.sh`。
- 本仓库是静态博客，`blog dev` 以前台方式运行 Hugo server，并依赖 Hugo 自带文件监听与热重载；停止本地预览使用 `Ctrl+C`。
- `blog dev` 启动前检查 `HUGO_PORT` 是否被占用；如果占用者是当前项目根目录下的 Hugo 进程，视为单例服务已运行并成功退出。
- `blog stop` 只停止当前项目根目录下、目标端口上的 Hugo 预览服务；端口未运行时成功提示未运行，端口被其他项目或其他进程占用时拒绝停止。
- `blog dev` 发现端口被其他进程占用时，只打印占用进程和处理建议，不自动换端口，不自动杀进程。
- 不为 Hugo 本地预览维护后台常驻、PID 文件或独立日志目录；日志直接看当前终端输出。
- 新增入口动作时，按“日常使用归 `blog`、排障诊断归 `doctor`”分类，并同步更新对应脚本的 `-h` 与 `README.md` 中的常用命令。
