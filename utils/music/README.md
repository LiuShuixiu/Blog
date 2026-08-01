# 音乐收藏数据管线

为博客的「音乐收藏」页（iPod Cover Flow 风格）生成数据。

数据源：**Apple Music 收藏的专辑**（本机「喜爱歌曲」反查专辑）+ **Spotify 爱心收藏**（可选）。统一按「专辑」维度跨源去重。

## 目录

| 文件 | 作用 |
| --- | --- |
| `export_apple_music.swift` | 用 Apple 官方 `iTunesLibrary.framework` 读本机「喜爱歌曲」→ 反查收藏的专辑 → `apple_music.json` + `covers/*.jpg`（800px 高清压缩封面） |
| `fetch_spotify_liked.js` | 用 Spotify Web API 拉爱心收藏 → `spotify.json` |
| `merge_music.js` | Spotify 单曲聚合到专辑、跨源按专辑去重 → `music.json` |
| `refresh_music.sh` | 一条龙刷新脚本 |

产物写入 `docs/.vuepress/public/music/`（封面随仓库提交，VuePress 构建时打包进站点）。

## 刷新数据

```bash
bash utils/music/refresh_music.sh
```

- 需要 macOS，且已登录 Apple Music
- **首次使用**：终端需在「系统设置 → 隐私与安全性 → 完全磁盘访问权限」中勾选，否则无法读取资料库
- 未配置 Spotify 凭证时自动跳过 Spotify，仅使用 Apple Music

## 配置 Spotify（可选）

1. 在 [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) 创建应用
2. 把应用的 Redirect URI 设为 `http://localhost:8888/callback`
3. 浏览器打开以下地址授权（把 `CLIENT_ID` 换成你的）：

   ```
   https://accounts.spotify.com/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A8888%2Fcallback&scope=user-library-read
   ```

4. 授权后地址栏会跳到 `http://localhost:8888/callback?code=XXX`，用 code 换 token：

   ```bash
   curl -X POST https://accounts.spotify.com/api/token \
     -d grant_type=authorization_code -d code=XXX \
     -d redirect_uri=http://localhost:8888/callback \
     -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)"
   ```

   返回的 `refresh_token` 填入环境变量。
5. 设置环境变量后重新运行刷新脚本：

   ```bash
   SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=xxx SPOTIFY_REFRESH_TOKEN=xxx \
     bash utils/music/refresh_music.sh
   ```

## 去重/聚合规则

- Apple Music 侧：读取「喜爱歌曲」（Loved Songs）播放列表，按专辑分组反查到收藏的专辑；每张专辑一条，含封面、trackCount、lovedCount
- Spotify 侧：爱心收藏是单曲，先按「专辑名 + 专辑艺术家」聚合成专辑卡
- 归一化：转小写 → 去组合变音符号 → 去所有非字母数字字符（保留中日韩）
- 去重 key = `专辑名|艺术家`
- 同专辑合并；封面优先 Apple Music（本地高清），Spotify 补充链接与 id
- 同一张专辑两边都有时，`sources` 记为 `apple_music+spotify`，`inBoth: true`

## 前端页面

- 组件：`docs/.vuepress/components/MusicCoverFlow.vue`
- 页面：`docs/05.我的/40.音乐收藏.md`，路由 `/music/`（无导航入口）
- 组件启动时 `fetch('/music/music.json')` 加载数据
