#!/usr/bin/env node
/**
 * fetch_spotify_liked.js
 * 从 Spotify 拉取用户的爱心收藏（Liked Songs / Saved Tracks），生成 spotify.json
 *
 * 需要环境变量：
 *   SPOTIFY_CLIENT_ID      - Spotify Developer 应用 Client ID
 *   SPOTIFY_CLIENT_SECRET  - Spotify Developer 应用 Client Secret
 *   SPOTIFY_REFRESH_TOKEN  - 用户授权后获取的 refresh token（scope: user-library-read）
 *
 * 首次获取 refresh token：
 *   1. 在 https://developer.spotify.com/dashboard 创建应用，拿到 Client ID / Secret
 *   2. 把应用 Redirect URI 设为 http://localhost:8888/callback
 *   3. 浏览器打开下面 URL 授权（替换 CLIENT_ID）：
 *      https://accounts.spotify.com/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A8888%2Fcallback&scope=user-library-read
 *   4. 授权后地址栏会跳到 http://localhost:8888/callback?code=XXX ，用 code 换 token：
 *      curl -X POST https://accounts.spotify.com/api/token \
 *        -d grant_type=authorization_code -d code=XXX \
 *        -d redirect_uri=http://localhost:8888/callback \
 *        -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)"
 *      返回 JSON 里的 refresh_token 填入环境变量
 *
 * 用法：node fetch_spotify_liked.js <输出目录>
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('❌ 缺少环境变量 SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET / SPOTIFY_REFRESH_TOKEN');
  process.exit(1);
}

const outputDir = process.argv[2];
if (!outputDir) {
  console.error('❌ 用法: node fetch_spotify_liked.js <输出目录>');
  process.exit(1);
}

/** 简单 promise 化的 HTTPS 请求 */
function request(url, options = {}, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** 用 refresh token 换 access token */
async function getAccessToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: REFRESH_TOKEN,
  }).toString();
  const res = await request(
    'https://accounts.spotify.com/api/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body
  );
  if (res.status !== 200) {
    console.error('❌ 换取 access token 失败:', res.status, res.body);
    process.exit(1);
  }
  return JSON.parse(res.body).access_token;
}

/** 分页拉取全部爱心收藏 */
async function fetchAllSavedTracks(token) {
  const songs = [];
  let url = 'https://api.spotify.com/v1/me/tracks?limit=50&offset=0';
  let pages = 0;
  while (url) {
    const res = await request(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) {
      console.error('❌ 拉取收藏失败:', res.status, res.body.slice(0, 500));
      process.exit(1);
    }
    const json = JSON.parse(res.body);
    for (const item of json.items) {
      const t = item.track;
      if (!t) continue;
      songs.push({
        title: t.name,
        artist: (t.artists || []).map((a) => a.name).join(', '),
        album: t.album?.name || '',
        cover: t.album?.images?.[0]?.url || t.album?.images?.[1]?.url || '',
        addedAt: item.added_at || '',
        spotifyId: t.id || '',
        spotifyUrl: t.external_urls?.spotify || '',
      });
    }
    pages++;
    url = json.next;
  }
  return { songs, pages };
}

(async () => {
  console.log('🔄 获取 access token...');
  const token = await getAccessToken();

  console.log('🔄 拉取爱心收藏...');
  const { songs, pages } = await fetchAllSavedTracks(token);
  console.log(`✅ 共拉取 ${pages} 页，${songs.length} 首`);

  const output = {
    source: 'spotify',
    exportedAt: new Date().toISOString(),
    songs,
  };

  const outPath = path.join(outputDir, 'spotify.json');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`✅ spotify.json 已写入: ${outPath}`);
})().catch((e) => {
  console.error('❌ 发生错误:', e);
  process.exit(1);
});
