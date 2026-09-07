# GitHub Pages 部署

本文说明本仓库如何通过 GitHub Actions 发布到 `https://amuqiao.github.io/blog/`。

## 发布链路

```text
push main
  -> GitHub Actions
  -> 安装 Hugo extended
  -> 拉取 Blowfish submodule
  -> hugo 构建 public/
  -> upload Pages artifact
  -> deploy 到 GitHub Pages
```

发布配置分两部分：

- GitHub 页面设置：`Settings -> Pages -> Build and deployment -> Source -> GitHub Actions`
- 仓库 workflow：`.github/workflows/hugo.yaml`

`public/` 是构建产物，不提交到仓库。

## 本地发布前检查

```bash
./run.sh blog verify
./run.sh doctor content-map
```

确认无误后提交并推送：

```bash
git add .
git commit -m "chore: update blog"
git push origin main
```

推送到 `main` 后，GitHub Actions 会自动部署。

## 查看部署状态

打开仓库的 `Actions` 页面：

```text
https://github.com/amuqiao/blog/actions
```

进入最新的 `Deploy Hugo site to Pages` 运行记录：

- 绿色：构建和部署成功
- 红色：点进失败步骤看日志
- 黄色：仍在运行，等完成后再访问站点

部署成功后访问：

```text
https://amuqiao.github.io/blog/
```

## 关键配置

Hugo 站点地址：

```toml
# config/_default/hugo.toml
baseURL = "https://amuqiao.github.io/blog/"
```

workflow 必须递归拉取主题 submodule：

```yaml
with:
  submodules: recursive
```

部署 job 需要 GitHub Pages 权限：

```yaml
permissions:
  pages: write
  id-token: write
```

## 常见问题

### 访问地址是 404

优先检查这几项：

1. `Settings -> Pages` 的 `Source` 是否是 `GitHub Actions`
2. `Actions` 里的最新 workflow 是否成功
3. 访问地址是否是 `https://amuqiao.github.io/blog/`
4. 是否刚部署完成，GitHub Pages 可能需要短时间刷新

### Actions 提示找不到主题

检查 `.gitmodules` 是否存在，并确认 workflow 里有：

```yaml
submodules: recursive
```

### 本地正常，线上路径不对

检查 `baseURL` 是否仍然是：

```text
https://amuqiao.github.io/blog/
```

如果以后改成独立域名或用户主页仓库，需要同步调整这个值。
