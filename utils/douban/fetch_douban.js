#!/usr/bin/env node
/**
 * fetch_douban.js
 * 抓取豆瓣用户的「看过/听过/读过 + 想看/想听/想读」收藏，并补充豆瓣评分，
 * 生成前端可直接加载的静态 JSON：
 *   docs/.vuepress/public/douban/movie.json
 *   docs/.vuepress/public/douban/tv.json
 *   docs/.vuepress/public/douban/anime.json   (从 tv.json 中按“动画/动漫”关键词拆分)
 *   docs/.vuepress/public/douban/drama.json   (从 tv.json 中拆分)
 *   docs/.vuepress/public/douban/music.json
 *   docs/.vuepress/public/douban/book.json
 *
 * 可用环境变量：
 *   DOUBAN_USER_ID  - 豆瓣用户 ID，默认 193640565（十一点睡着了）
 *
 * 用法：
 *   node utils/douban/fetch_douban.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DOUBAN_USER_ID = process.env.DOUBAN_USER_ID || '193640565';
const OUTPUT_DIR = path.resolve(__dirname, '../../docs/.vuepress/public/douban');
const COVERS_DIR = path.join(OUTPUT_DIR, 'covers');
const MAX_PAGES = 20;
const PAGE_SIZE = 15;
const CONCURRENCY = 4;
const FETCH_TIMEOUT = 10000;

const BASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  'Referer': 'https://www.douban.com/',
};

const MOBILE_HEADERS = {
  ...BASE_HEADERS,
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
};

// 豆瓣收藏页的状态：collect=看过/听过/读过，do=在看/在听/在读，wish=想看/想听/想读
const STATUSES = ['collect', 'do', 'wish'];

const CATEGORY_CONFIG = {
  movie: { domain: 'movie', type: 'movie' },
  tv:    { domain: 'movie', type: 'tv' },
  music: { domain: 'music', type: '' },
  book:  { domain: 'book', type: '' },
};

// 详情页域名：电视剧也使用 m.douban.com/movie/subject/xxx
const DETAIL_DOMAIN = {
  movie: 'movie',
  tv: 'movie',
  music: 'music',
  book: 'book',
};

function decodeHtml(input) {
  if (!input) return '';
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(html) {
  return decodeHtml((html || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (!options._retried) {
      await sleep(500);
      return fetchWithTimeout(url, { ...options, _retried: true }, timeout);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtml(url, headers = BASE_HEADERS) {
  const res = await fetchWithTimeout(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${url}`);
  }
  return res.text();
}

function getListUrl(category, status, page) {
  const { domain, type } = CATEGORY_CONFIG[category];
  const params = new URLSearchParams({
    sort: 'time',
    start: String(page * PAGE_SIZE),
    filter: 'all',
    mode: 'grid',
  });
  if (type) params.set('type', type);
  return `https://${domain}.douban.com/people/${DOUBAN_USER_ID}/${status}?${params.toString()}`;
}

function statusText(category, status) {
  const map = {
    movie: { collect: '看过', do: '在看', wish: '想看' },
    tv: { collect: '看过', do: '在看', wish: '想看' },
    music: { collect: '听过', do: '在听', wish: '想听' },
    book: { collect: '读过', do: '在读', wish: '想读' },
  };
  return (map[category] || map.movie)[status] || status;
}


function parseItemsFromHtml(html, status, category) {
  const items = [];
  const itemBlocks = [];

  // 电影/电视/音乐收藏页：<div class="item ...">...</div>
  const divParts = html.split(/<div class="item\b/).slice(1);
  for (const part of divParts) {
    itemBlocks.push('<div class="item' + part);
  }

  // 读书收藏页：<li class="subject-item">...</li>
  const liRe = /<li[^>]*class="[^"]*subject-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
  let liMatch;
  while ((liMatch = liRe.exec(html)) !== null) {
    itemBlocks.push('<div class="item ' + liMatch[1]);
  }

  for (const block of itemBlocks) {
    const idMatch = block.match(/subject\/(\d+)\//);
    if (!idMatch) continue;

    const titleMatch =
      block.match(/<em>([\s\S]*?)<\/em>/) ||
      block.match(/<a[^>]+title="([^"]+)"[^>]*>/);
    const title = titleMatch ? stripTags(titleMatch[1]) : '';
    if (!title) continue;

    const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
    const cover = imgMatch ? imgMatch[1].replace(/&amp;/g, '&') : '';

    const ratingMatch = block.match(/class="rating(\d)-t"/);
    const myRating = ratingMatch ? Number(ratingMatch[1]) : null;

    const commentMatch =
      block.match(/<span class="comment">([\s\S]*?)<\/span>/) ||
      block.match(/<p class="comment[^"]*">([\s\S]*?)<\/p>/);
    const comment = commentMatch ? stripTags(commentMatch[1]) : '';

    const dateMatch = block.match(/<span class="date">([\s\S]*?)<\/span>/);
    const date = dateMatch ? (dateMatch[1].match(/\d{4}-\d{2}-\d{2}/) || [''])[0] : '';

    const introMatch =
      block.match(/<li class="intro">([\s\S]*?)<\/li>/) ||
      block.match(/<div class="pub">([\s\S]*?)<\/div>/);
    const intro = introMatch ? stripTags(introMatch[1]) : '';

    const url = `https://${CATEGORY_CONFIG[category].domain}.douban.com/subject/${idMatch[1]}/`;
    const kind = /动画|动漫/.test(title + ' ' + intro) ? 'anime' : 'drama';

    items.push({
      id: idMatch[1],
      title,
      cover,
      url,
      status: statusText(category, status),
      date,
      myRating,
      myRatingText: myRating
        ? ({ 5: '力荐', 4: '推荐', 3: '还行', 2: '较差', 1: '很差' })[myRating]
        : '',
      comment,
      intro,
      kind: category === 'tv' ? kind : undefined,
      rating: null,
      ratingCount: null,
    });
  }

  return items;
}

async function enrichDetail(item, category) {
  const domain = DETAIL_DOMAIN[category];
  const url = `https://m.douban.com/${domain}/subject/${item.id}/`;
  try {
    const html = await fetchHtml(url, MOBILE_HEADERS);
    const ratingMatch = html.match(/<meta itemprop="ratingValue" content="([^"]+)"/);
    const countMatch = html.match(/<meta itemprop="reviewCount" content="([^"]+)"/);
    if (ratingMatch) item.rating = Number(ratingMatch[1]);
    if (countMatch) item.ratingCount = Number(countMatch[1]);
  } catch (e) {
    // 详情失败不阻塞，保留收藏页已有的信息
  }
  return item;
}

async function downloadCover(item, category) {
  const remote = item.cover;
  if (!remote || !/^https?:\/\//i.test(remote)) return;

  const extMatch = remote.match(/\.(jpe?g|png|webp|gif)/i);
  const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
  const filename = `${category}_${item.id}.${ext}`;
  const localPath = path.join(COVERS_DIR, filename);
  const localUrl = `/douban/covers/${filename}`;

  if (fs.existsSync(localPath)) {
    item.cover = localUrl;
    return;
  }

  const domain = CATEGORY_CONFIG[category].domain;
  try {
    const res = await fetchWithTimeout(remote, {
      headers: { ...BASE_HEADERS, Referer: `https://${domain}.douban.com/` },
    }, FETCH_TIMEOUT * 2);
    if (!res.ok) return;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) return;
    fs.mkdirSync(COVERS_DIR, { recursive: true });
    fs.writeFileSync(localPath, buffer);
    item.cover = localUrl;
  } catch (e) {
    // 下载失败时保留原远程地址，避免阻塞整个数据更新
  }
}


async function mapLimit(list, limit, fn) {
  const results = new Array(list.length);
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const index = cursor++;
      results[index] = await fn(list[index], index);
    }
  }
  const workers = Array.from({ length: Math.min(limit, list.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function fetchCategory(category) {
  const all = [];
  const seen = new Set();

  for (const status of STATUSES) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = getListUrl(category, status, page);
      let html;
      try {
        html = await fetchHtml(url);
      } catch (e) {
        console.warn(`  ⚠️ 跳过 ${category}/${status} 第 ${page + 1} 页: ${e.message}`);
        break;
      }

      const items = parseItemsFromHtml(html, status, category);
      if (!items.length) break;

      for (const item of items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          all.push(item);
        }
      }

      if (items.length < PAGE_SIZE) break;
    }
  }

  console.log(`  📥 ${category}: 共 ${all.length} 条收藏`);
  const enriched = await mapLimit(all, CONCURRENCY, async (item) => {
      await enrichDetail(item, category);
      await downloadCover(item, category);
      return item;
    });
  enriched.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return enriched;
}

function writeJson(name, type, items, extra = {}) {
  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'douban',
    userId: DOUBAN_USER_ID,
    type,
    total: items.length,
    items,
    ...extra,
  };
  const file = path.join(OUTPUT_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
  console.log(`  ✅ ${path.relative(process.cwd(), file)} (${items.length})`);
}

function splitTvByKind(tvItems) {
  const anime = tvItems.filter((item) => item.kind === 'anime');
  const drama = tvItems.filter((item) => item.kind !== 'anime');
  return { anime, drama };
}

function existingCount(name) {
  try {
    const file = path.join(OUTPUT_DIR, `${name}.json`);
    if (!fs.existsSync(file)) return 0;
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Number(json.total) || 0;
  } catch (e) {
    return 0;
  }
}


async function main() {
  console.log(`🚀 开始抓取豆瓣用户 ${DOUBAN_USER_ID} 的收藏数据`);
  console.log(`   输出目录: ${OUTPUT_DIR}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const movie = await fetchCategory('movie');
  const tv = await fetchCategory('tv');
  const music = await fetchCategory('music');
  const book = await fetchCategory('book');

  // 防止豆瓣限制/网络异常导致已有数据被空数据覆盖
  const emptyGuards = [
    ['movie', movie.length],
    ['tv', tv.length],
    ['music', music.length],
    ['book', book.length],
  ].filter(([name, count]) => count === 0 && existingCount(name) > 0);
  if (emptyGuards.length) {
    throw new Error(`本次未抓取到 ${emptyGuards.map(([name]) => name).join(', ')} 数据，已保留原文件。`);
  }

  const { anime, drama } = splitTvByKind(tv);

  writeJson('movie', 'movie', movie);
  writeJson('tv', 'tv', tv, { animeCount: anime.length, dramaCount: drama.length });
  writeJson('anime', 'anime', anime, { sourceType: 'tv' });
  writeJson('drama', 'drama', drama, { sourceType: 'tv' });
  writeJson('music', 'music', music);
  writeJson('book', 'book', book);

  console.log('🎉 豆瓣数据更新完成');
}

main().catch((err) => {
  console.error('❌ 抓取失败:', err);
  process.exit(1);
});
