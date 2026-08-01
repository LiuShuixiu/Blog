#!/usr/bin/env node
/**
 * merge_music.js
 * 合并 Apple Music 与 Spotify 收藏，按「专辑」维度去重后生成最终 music.json
 *
 * 用法：node merge_music.js <数据目录>
 *   <数据目录> 下需要存在:
 *     - apple_music.json  (由 export_apple_music.swift 生成，albums 数组)
 *     - spotify.json      (由 fetch_spotify_liked.js 生成，songs 数组)
 *   生成的 music.json 写到同一目录。
 *
 * 聚合逻辑：
 *   - Apple Music 直接是专辑列表（albums）
 *   - Spotify 是单曲（songs），按「专辑名 + 专辑艺术家」分组聚合成专辑卡
 *   - 去重 key = 「专辑名 + 艺术家」归一化；同专辑时合并，封面优先 Apple
 */

const fs = require('fs');
const path = require('path');

const dataDir = process.argv[2];
if (!dataDir) {
  console.error('❌ 用法: node merge_music.js <数据目录>');
  process.exit(1);
}

/** 归一化 key：小写、去变音符号、去所有非字母数字字符 */
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // 去组合变音符号
    .replace(/[^a-z0-9一-鿿]+/g, ''); // 去标点/空格，保留中日韩字符
}

function loadJson(name) {
  const p = path.join(dataDir, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const am = loadJson('apple_music.json');
const sp = loadJson('spotify.json');

if (!am && !sp) {
  console.error('❌ 数据目录中既没有 apple_music.json 也没有 spotify.json');
  process.exit(1);
}

const merged = new Map(); // key -> album

/** 追加一个来源的专辑卡 */
function addAlbum(album, source) {
  const key = normalize(album.artist) + '|' + normalize(album.title);
  const existing = merged.get(key);
  if (!existing) {
    merged.set(key, { ...album, sources: [source] });
    return;
  }
  if (!existing.sources.includes(source)) existing.sources.push(source);
  // 封面优先 Apple Music
  if (source === 'apple_music' && album.cover) {
    existing.cover = album.cover;
  } else if (!existing.cover && album.cover) {
    existing.cover = album.cover;
  }
  // 合并 Spotify 链接/id
  if (source === 'spotify') {
    if (album.spotifyUrl) existing.spotifyUrl = album.spotifyUrl;
    if (album.spotifyId) existing.spotifyId = album.spotifyId;
    if (album.likedCount) existing.likedCount = album.likedCount;
  }
}

// 1. Apple Music 专辑
if (am && Array.isArray(am.albums)) {
  for (const a of am.albums) {
    addAlbum({
      title: a.title,
      artist: a.artist,
      cover: a.cover,
      trackCount: a.trackCount || 0,
      lovedCount: a.lovedCount || 1,
    }, 'apple_music');
  }
}

// 2. Spotify 单曲 → 按专辑分组聚合
if (sp && Array.isArray(sp.songs)) {
  const spotifyAlbums = new Map(); // 专辑名|艺术家 -> 聚合卡
  for (const s of sp.songs) {
    if (!s.album || !s.artist) continue;
    const key = normalize(s.artist) + '|' + normalize(s.album);
    const existing = spotifyAlbums.get(key);
    if (existing) {
      existing.likedCount++;
      if (!existing.spotifyUrl && s.spotifyUrl) existing.spotifyUrl = s.spotifyUrl;
      // 尽可能选第一张封面
      if (!existing.cover && s.cover) existing.cover = s.cover;
    } else {
      spotifyAlbums.set(key, {
        title: s.album,
        artist: s.artist,
        cover: s.cover || '',
        likedCount: 1,
        spotifyUrl: s.spotifyUrl || '',
      });
    }
  }
  for (const a of spotifyAlbums.values()) {
    addAlbum(a, 'spotify');
  }
}

const albums = [...merged.values()].map(({ sources, ...a }) => ({
  ...a,
  inBoth: sources.length > 1,
  sources: sources.join('+'),
}));

// 按艺术家排序
albums.sort((a, b) => (a.artist || '').localeCompare(b.artist || '', 'zh-Hans-CN'));

const output = {
  updatedAt: new Date().toISOString(),
  type: 'albums',
  total: albums.length,
  fromAppleMusic: albums.filter((a) => a.sources.includes('apple_music')).length,
  fromSpotify: albums.filter((a) => a.sources.includes('spotify')).length,
  inBoth: albums.filter((a) => a.inBoth).length,
  albums,
};

const outPath = path.join(dataDir, 'music.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`✅ music.json 已写入: ${outPath}`);
console.log(`   专辑总数: ${output.total}`);
console.log(`   来源 Apple Music: ${output.fromAppleMusic} | Spotify: ${output.fromSpotify} | 两边都有: ${output.inBoth}`);
