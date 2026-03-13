# 部署脚本使用指南

## 概述

本项目提供了一套完整的部署脚本，用于构建、部署和推送博客。所有脚本已整合到 `deploy.sh` 中，支持多种部署模式。

## 脚本结构

### 主脚本
- **deploy.sh** - 统一部署脚本，支持多种模式
- **ops.sh** - 交互式菜单脚本，提供图形化操作界面
- **deploy_again.sh** - 快速重新部署脚本（已整合到 deploy.sh）

## 快速使用

### 方式一：直接调用 bash 脚本

#### 全量构建并部署（默认）
```bash
bash deploy.sh
# 或指定模式
bash deploy.sh build
```

#### 快速重新部署（跳过构建）
```bash
bash deploy.sh redeploy
```

#### 只推送本地源代码
```bash
bash deploy.sh push
```

#### 完整流程（构建 + 部署 + 推送源代码）
```bash
bash deploy.sh all
```

### 方式二：使用 npm 脚本

#### 构建并部署
```bash
npm run deploy
# 等同于: npm run build:win + 部署到 io 远程
```

#### 快速重新部署
```bash
npm run deploy:redeploy
```

#### 推送源代码
```bash
npm run deploy:push
```

#### 完整部署流程
```bash
npm run deploy:all
```

### 方式三：交互式菜单

```bash
npm run ops
# 或
bash ops.sh
```

菜单选项：
- **1** - 启动开发服务器
- **2** - 构建项目
- **3** - 推送源代码
- **4** - 构建并部署
- **5** - 快速重新部署
- **6** - 拉取远程更新
- **7** - 完整部署流程（推荐）
- **0** - 退出

## 各部署模式详解

### 1. build（推荐日常使用）
**完整流程：构建 → 部署到 io 远程**

```bash
bash deploy.sh build
```

**步骤：**
1. 执行 `npm run build:win` 构建项目
2. 要求输入提交信息
3. 将构建的 dist 文件夹推送到 io 远程仓库
4. 自动清理 dist 文件夹

**适用场景：** 有新内容或更新时的标准部署

---

### 2. redeploy（快速重新部署）
**快速流程：跳过构建直接部署**

```bash
bash deploy.sh redeploy
```

**步骤：**
1. 要求输入提交信息
2. 直接使用现有的 dist 文件夹推送到 io 远程
3. 自动清理 dist 文件夹

**适用场景：** 
- 前次构建后发现部署有问题
- 只需修改部署配置而不改变内容
- 快速修复部署错误

---

### 3. push（推送源代码）
**推送本地源代码到 GitHub**

```bash
bash deploy.sh push
```

**步骤：**
1. 添加所有本地更改
2. 要求输入提交信息
3. 推送到 origin 主分支

**适用场景：** 
- 备份源代码
- 与团队协作
- 只想推送代码不部署

---

### 4. all（完整流程，推荐周期性使用）
**完整流程：构建 → 部署 → 推送源代码**

```bash
bash deploy.sh all
```

**步骤：**
1. 执行 `npm run build:win` 构建项目
2. 要求输入提交信息
3. 推送构建文件到 io 远程
4. 推送源代码到 GitHub
5. 自动清理 dist 文件夹

**适用场景：** 
- 完整的部署和备份流程
- 定期同步源代码和部署文件

---

## 提交信息说明

各模式都会要求输入提交信息：

```
请输入提交信息: blog update
```

**建议的提交信息格式：**
- `blog update` - 通用更新
- `add new post` - 添加新文章
- `fix typo` - 修复错别字
- `update styles` - 样式更新
- `optimize performance` - 性能优化

如果只按回车不输入，将使用默认提交信息。

## 工作流示例

### 日常更新流程
```bash
# 1. 本地开发
npm run dev:win

# 2. 完成更新后，执行部署（推荐）
npm run deploy

# 3. 按提示输入提交信息
# 输入: add a new blog post
```

### 定期完整同步（日/周期）
```bash
# 一次性完成：构建 + 部署 + 备份源代码
npm run deploy:all

# 或使用交互菜单选择第 7 项
npm run ops
```

### 快速修复部署问题
```bash
# 快速重新部署，无需等待构建
npm run deploy:redeploy
```

## 特性说明

### ✓ 错误处理
- 脚本遇到错误会立即停止（set -e）
- 提供清晰的错误提示
- 自动清理失败时的临时文件

### ✓ 彩色输出
- 蓝色：操作头部信息
- 绿色：成功提示（✓）
- 红色：错误提示（✗）
- 黄色：信息提示（→）

### ✓ 进度提示
- 显示各步骤的执行状态
- 清晰的步骤分离
- 显示目标仓库和分支信息

### ✓ 自动清理
- 部署完成后自动删除 dist 文件夹
- 减少磁盘占用

## 常见问题

### Q: 部署后没有更新？
A: 可能是浏览器缓存。尝试：
1. 清空浏览器缓存
2. 使用无痕模式访问
3. 等待 CDN 刷新（可能需要几分钟）

### Q: 怎么只修改源代码不部署？
A: 使用 push 模式：
```bash
npm run deploy:push
```

### Q: 前次构建后想快速重新部署？
A: 使用 redeploy 模式：
```bash
npm run deploy:redeploy
```

### Q: 如何同时备份源代码？
A: 使用 all 模式：
```bash
npm run deploy:all
```

## 脚本配置

所有配置在 `deploy.sh` 的配置部分：

```bash
dist_path="docs/.vuepress/dist"        # 构建输出目录
push_addr=$(git remote get-url --push io)  # io 远程地址
push_branch="main"                     # 部署目标分支
source_branch="main"                   # 源代码推送分支
```

如需修改，编辑 `deploy.sh` 中的这些变量即可。

## 许可证

MIT License
