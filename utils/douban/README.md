# 豆瓣收藏数据管线

将豆瓣用户的「看过/听过/读过 + 想看/想听/想读」收藏抓取为静态 JSON，
供博客「鉴赏」系列页面展示豆瓣评分、个人评分与短评。

## 数据源

- 豆瓣用户 ID：`193640565`（十一点睡着了）
- 可随时通过环境变量 `DOUBAN_USER_ID` 覆盖

## 生成文件

每次运行 `node utils/douban/fetch_douban.js` 会更新：

| 文件 | 内容 |
| --- | --- |
| `docs/.vuepress/public/douban/movie.json` | 电影收藏（看过 + 想看） |
| `docs/.vuepress/public/douban/tv.json` | 电视剧收藏（看过 + 想看） |
| `docs/.vuepress/public/douban/anime.json` | 从 tv.json 按“动画/动漫”关键词拆分出的番剧 |
| `docs/.vuepress/public/douban/drama.json` | 从 tv.json 拆分出的剧集 |
| `docs/.vuepress/public/douban/music.json` | 音乐收藏 |
| `docs/.vuepress/public/douban/book.json` | 书籍收藏 |

封面也会一并下载到 `docs/.vuepress/public/douban/covers/`。  
这是因为豆瓣图片 CDN 有防盗链，直接外链到 GitHub Pages 会返回 `418 I'm a Teapot`；改为本地图片后可以稳定显示。


每条数据包含：

- `rating`：豆瓣评分（从豆瓣移动端详情页抓取）
- `ratingCount`：豆瓣评分人数
- `myRating` / `myRatingText`：我的豆瓣评分（1–5 星）和“力荐/推荐/还行/较差/很差”
- `comment`：我的豆瓣短评
- `status`：已看过/正在看/想看 等状态
- `cover`、`url`、`date` 等

## 本地更新

```bash
DOUBAN_USER_ID=193640565 npm run douban:update
```

## 自动更新

`.github/workflows/douban-update.yml` 已配置：

- `schedule`：每 12 小时自动运行一次（UTC 0/12 点）
- `workflow_dispatch`：支持在 GitHub Actions 页面手动触发
- 脚本抓取成功后会提交 `docs/.vuepress/public/douban/` 变更到 main 分支

main 分支推送后，`.github/workflows/ci.yml` 会自动构建博客并部署到 gh-pages。
