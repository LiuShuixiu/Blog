<template>
  <div class="music-cf">
    <!-- 数据加载/占位 -->
    <div v-if="loading" class="cf-placeholder">
      <span class="cf-spinner"></span>
      <p>正在加载音乐收藏…</p>
    </div>
    <div v-else-if="!albums.length" class="cf-placeholder">
      <p>还没有音乐收藏数据。</p>
    </div>

    <template v-else>
      <!-- 顶部标题 -->
      <div class="cf-header">
        <div class="cf-title">{{ title }}</div>
        <div class="cf-subtitle">
          {{ albums.length }} 张专辑 · {{ sourceText }}<span v-if="updatedAt"> · 更新于 {{ updatedAt }}</span>
        </div>
      </div>

      <!-- Cover Flow 主舞台 -->
      <div
        class="cf-stage"
        ref="stage"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseUp"
        @wheel.prevent="onWheel"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      >
        <div
          v-for="item in visibleItems"
          :key="item.key"
          class="cf-cover"
          :class="{ active: item.index === current }"
          :style="coverStyle(item.index)"
          @click="onCoverClick(item.index)"
        >
          <img
            class="no-zoom"
            :src="coverUrl(item.album)"
            :alt="item.album.title"
            loading="lazy"
            draggable="false"
          />
          <!-- 镜面倒影：仅中心封面显示镜像 -->
          <img
            v-if="item.index === current"
            class="cf-mirror no-zoom"
            :src="coverUrl(item.album)"
            aria-hidden="true"
            draggable="false"
          />
          <div class="cf-cover-spotify" v-if="item.album.spotifyUrl">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 0 1-.32-1.46c4.57-1.05 8.5-.6 11.65 1.34a.75.75 0 0 1 .25 1.03zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.98-8.15-2.56-11.97-1.4a.94.94 0 1 1-.56-1.79c4.36-1.33 9.78-.68 13.5 1.59.44.27.57.85.32 1.29zm.13-3.4C15.24 8.36 9.35 8.13 5.62 9.25a1.13 1.13 0 1 1-.65-2.15c4.27-1.3 10.8-1.03 15.05 1.9a1.13 1.13 0 1 1-1.3 1.83z"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- 底部信息栏 -->
      <div class="cf-info">
        <button class="cf-nav-btn" @click="go(-1)" aria-label="上一首">‹</button>
        <div class="cf-now">
          <div class="cf-now-title" v-if="currentAlbum">{{ currentAlbum.title }}</div>
          <div class="cf-now-artist" v-if="currentAlbum">{{ currentAlbum.artist }}</div>
          <div class="cf-now-empty" v-else>—</div>
        </div>
        <div class="cf-position">{{ current + 1 }} / {{ albums.length }}</div>
        <button class="cf-nav-btn" @click="go(1)" aria-label="下一首">›</button>
      </div>
    </template>
  </div>
</template>

<script>
// iPod Cover Flow 音乐收藏组件
// 数据源: /music/music.json （由 utils/music 脚本生成）
const WINDOW = 12; // 中心两侧各渲染的张数

export default {
  name: 'MusicCoverFlow',
  data() {
    return {
      loading: true,
      error: '',
      albums: [],
      updatedAt: '',
      title: '我的音乐收藏',
      current: 0,
      // 拖拽状态
      dragging: false,
      dragStartX: 0,
      dragDelta: 0,
      touchStartX: 0,
      touchDelta: 0,
    };
  },
  computed: {
    sourceText() {
      const count = { apple_music: 0, spotify: 0 };
      for (const a of this.albums) {
        if (a.sources && a.sources.includes('apple_music')) count.apple_music++;
        if (a.sources && a.sources.includes('spotify')) count.spotify++;
      }
      const parts = [];
      if (count.apple_music) parts.push(`Apple Music ${count.apple_music}`);
      if (count.spotify) parts.push(`Spotify ${count.spotify}`);
      return parts.join(' · ') || '—';
    },
    currentAlbum() {
      return this.albums[this.current] || null;
    },
    // 只渲染中心附近的封面，提升性能
    visibleItems() {
      const n = this.albums.length;
      if (!n) return [];
      const items = [];
      for (let off = -WINDOW; off <= WINDOW; off++) {
        let idx = this.current + off;
        idx = ((idx % n) + n) % n; // 环形索引
        items.push({ index: idx, key: `${idx}_${off}`, album: this.albums[idx] });
      }
      return items;
    },
  },
  mounted() {
    this.loadData();
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.onKeydown);
  },
  methods: {
    async loadData() {
      this.loading = true;
      try {
        const base = typeof this.$withBase === 'function' ? this.$withBase('/music/music.json') : '/music/music.json';
        const res = await fetch(base);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        this.albums = (json.albums || json.songs || []).filter((a) => a.title && a.artist);
        this.updatedAt = (json.updatedAt || '').slice(0, 10);
        if (json.title) this.title = json.title;
        if (!this.albums.length) this.error = '没有数据';
      } catch (e) {
        this.error = String((e && e.message) || e);
        console.error('[MusicCoverFlow] 加载失败:', e);
      } finally {
        this.loading = false;
      }
    },
    // 封面 URL: Spotify 远程封面直接用，否则用本地 /music/covers/
    coverUrl(item) {
      const cover = item.cover || '';
      if (!cover) return '';
      if (/^https?:\/\//i.test(cover)) return cover;
      const base = typeof this.$withBase === 'function' ? this.$withBase('/music/covers/') : '/music/covers/';
      return base + cover;
    },
    // 计算每张封面的变换样式
    coverStyle(index) {
      const n = this.albums.length;
      let off = index - this.current;
      // 环形取最近的差值
      if (off > n / 2) off -= n;
      if (off < -n / 2) off += n;

      const abs = Math.abs(off);
      const scale = off === 0 ? 1 : Math.max(0.32, 1 - abs * 0.13);
      const opacity = off === 0 ? 1 : Math.max(0.18, 1 - abs * 0.17);
      const rotateY = off === 0 ? 0 : (off < 0 ? -38 : 38) * Math.min(1, abs * 0.8);
      const translateX = off * 118 + (off === 0 ? 0 : (off > 0 ? 28 : -28));
      const translateZ = off === 0 ? 90 : -abs * 42;
      const zIndex = 100 - abs;

      return {
        transform: `translate3d(${translateX}px, 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
        opacity,
        zIndex,
      };
    },
    go(step) {
      const n = this.albums.length;
      if (!n) return;
      this.current = ((this.current + step) % n + n) % n;
    },
    onCoverClick(index) {
      const a = this.albums[index];
      if (a && a.spotifyUrl) {
        window.open(s.spotifyUrl, '_blank', 'noopener');
      }
    },
    // 键盘
    onKeydown(e) {
      if (e.key === 'ArrowLeft') this.go(-1);
      else if (e.key === 'ArrowRight') this.go(1);
    },
    // 滚轮
    onWheel(e) {
      const delta = e.deltaY || e.deltaX;
      this.go(delta > 0 ? 1 : -1);
    },
    // 鼠标拖拽
    onMouseDown(e) {
      this.dragging = true;
      this.dragStartX = e.clientX;
      this.dragDelta = 0;
    },
    onMouseMove(e) {
      if (!this.dragging) return;
      this.dragDelta = e.clientX - this.dragStartX;
      if (Math.abs(this.dragDelta) >= 50) {
        this.go(this.dragDelta > 0 ? -1 : 1);
        this.dragStartX = e.clientX;
        this.dragDelta = 0;
      }
    },
    onMouseUp() {
      this.dragging = false;
      this.dragDelta = 0;
    },
    // 触摸
    onTouchStart(e) {
      if (!e.touches.length) return;
      this.touchStartX = e.touches[0].clientX;
      this.touchDelta = 0;
    },
    onTouchMove(e) {
      if (!e.touches.length) return;
      this.touchDelta = e.touches[0].clientX - this.touchStartX;
    },
    onTouchEnd() {
      if (Math.abs(this.touchDelta) >= 40) {
        this.go(this.touchDelta > 0 ? -1 : 1);
      }
      this.touchDelta = 0;
    },
  },
};
</script>

<style scoped>
/* 深色 Cover Flow 主舞台 */
.music-cf {
  --cf-bg: #10151c;
  --cf-rail: rgba(255, 255, 255, 0.08);
  --cf-text: #e8edf2;
  --cf-text-dim: #8b96a4;
  --cf-accent: #1db954;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(180deg, var(--cf-bg) 0%, #1a222c 60%, #0d1117 100%);
  color: var(--cf-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-user-select: none;
  user-select: none;
  box-sizing: border-box;
}

.cf-header {
  padding: 18px 20px 4px;
}
.cf-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.cf-subtitle {
  font-size: 12px;
  color: var(--cf-text-dim);
  margin-top: 4px;
}

/* ---- 主舞台 ---- */
.cf-stage {
  position: relative;
  height: 320px;
  margin: 20px 8px 8px;
  perspective: 1100px;
  cursor: grab;
}
.cf-stage:active {
  cursor: grabbing;
}

.cf-cover {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 196px;
  height: 196px;
  margin-left: -98px;
  margin-top: -98px;
  transform-style: preserve-3d;
  transition: transform 0.28s cubic-bezier(0.2, 0.7, 0.3, 1), opacity 0.28s ease;
  cursor: pointer;
  will-change: transform, opacity;
}
.cf-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4);
  background: #222;
  /* 覆写主题全局 img 规则 */
  display: block;
  margin: 0;
  border: none;
}

.cf-cover.active {
  z-index: 100;
}

/* 镜面倒影：独立镜像元素（跨浏览器） */
.cf-mirror {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  height: 100%;
  margin-top: 10px;
  transform: scaleY(-1);
  opacity: 0.26;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent 82%);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent 82%);
  pointer-events: none;
  box-shadow: none;
  border-radius: 10px;
}

/* Spotify 角标 */
.cf-cover-spotify {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--cf-accent);
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
}

/* ---- 底部信息栏 ---- */
.cf-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px 18px;
}
.cf-nav-btn {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--cf-rail);
  background: rgba(255, 255, 255, 0.05);
  color: var(--cf-text);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s;
}
.cf-nav-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}
.cf-now {
  flex: 1;
  min-width: 0;
  text-align: center;
}
.cf-now-title {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cf-now-artist {
  font-size: 12.5px;
  color: var(--cf-text-dim);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cf-now-empty {
  font-size: 13px;
  color: var(--cf-text-dim);
}
.cf-position {
  flex: none;
  font-size: 12px;
  color: var(--cf-text-dim);
  font-variant-numeric: tabular-nums;
}

/* ---- 占位 ---- */
.cf-placeholder {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--cf-text-dim);
}
.cf-placeholder p {
  margin: 0;
}
.cf-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--cf-accent);
  border-radius: 50%;
  animation: cf-spin 0.9s linear infinite;
}
@keyframes cf-spin {
  to { transform: rotate(360deg); }
}

/* 移动端适配 */
@media (max-width: 719px) {
  .cf-stage { height: 250px; }
  .cf-cover { width: 150px; height: 150px; margin-left: -75px; margin-top: -75px; }
  .cf-mirror { margin-top: 7px; }
}
</style>
