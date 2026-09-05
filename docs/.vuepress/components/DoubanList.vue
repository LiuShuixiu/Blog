<template>
  <div class="douban-list">
    <div v-if="loading" class="db-placeholder">
      <span class="db-spinner"></span>
      <span>正在加载豆瓣数据…</span>
    </div>
    <div v-else-if="!items.length" class="db-placeholder">
      <span>暂无豆瓣收藏数据</span>
    </div>

    <template v-else>
      <div class="db-header">
        <div class="db-title">
          <span class="db-dot"></span>{{ displayTitle }}
        </div>
        <div class="db-meta">
          {{ items.length }} 条收藏
          <a
            v-if="profileUrl"
            class="db-profile-link"
            :href="profileUrl"
            target="_blank"
            rel="noopener noreferrer"
          >数据来自豆瓣</a>
          <span v-else>数据来自豆瓣</span>
          <span v-if="updatedAt"> · 更新于 {{ updatedAt }}</span>
        </div>
      </div>

      <div class="db-grid">
        <a
          v-for="item in items"
          :key="item.id"
          class="db-card"
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div class="db-cover-wrap">
            <img
              v-if="item.cover"
              class="no-zoom"
              :src="coverUrl(item.cover)"
              :alt="item.title"
              loading="lazy"
              draggable="false"
            />
            <div v-else class="db-cover-empty">暂无封面</div>
            <span class="db-status">{{ item.status }}</span>
          </div>

          <div class="db-body">
            <div class="db-item-title">{{ item.title }}</div>
            <div v-if="item.intro" class="db-intro">{{ item.intro }}</div>

            <div class="db-rating-row">
              <span class="db-douban-rating">
                <span v-if="item.rating != null" class="db-score">{{ formatRating(item.rating) }}</span>
                <span v-else class="db-score-none">暂无</span>
                <span class="db-rating-label">豆瓣评分</span>
                <span v-if="item.ratingCount" class="db-count">({{ formatCount(item.ratingCount) }})</span>
              </span>

              <span v-if="item.myRating" class="db-my-rating">
                <span class="db-stars">{{ starText(item.myRating) }}</span>
                <span>{{ item.myRatingText }}</span>
              </span>

              <span v-if="item.date" class="db-date">{{ item.date }}</span>
            </div>

            <p v-if="item.comment" class="db-comment">“{{ item.comment }}”</p>
            <p v-else-if="item.status === '看过' || item.status === '读过' || item.status === '听过'" class="db-comment-empty">
              暂无短评
            </p>
          </div>
        </a>
      </div>
    </template>
  </div>
</template>

<script>
const TITLE_MAP = {
  movie: '电影收藏',
  tv: '电视剧收藏',
  anime: '番剧收藏',
  drama: '剧集收藏',
  music: '音乐收藏',
  book: '书籍收藏',
};

export default {
  name: 'DoubanList',
  props: {
    type: {
      type: String,
      default: 'movie',
    },
    title: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      loading: true,
      items: [],
      updatedAt: '',
      userId: '',
      error: '',
    };
  },
  computed: {
    displayTitle() {
      return this.title || TITLE_MAP[this.type] || '豆瓣收藏';
    },
    profileUrl() {
      return this.userId ? `https://www.douban.com/people/${this.userId}/` : '';
    },
  },
  mounted() {
    this.loadData();
  },
  methods: {
    async loadData() {
      this.loading = true;
      const base =
        typeof this.$withBase === 'function'
          ? this.$withBase(`/douban/${this.type}.json`)
          : `/douban/${this.type}.json`;
      try {
        const res = await fetch(base);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        this.items = json.items || [];
        this.updatedAt = (json.updatedAt || '').slice(0, 10);
        this.userId = json.userId || '';
      } catch (e) {
        this.error = String((e && e.message) || e);
        console.error('[DoubanList] 加载失败:', e);
      } finally {
        this.loading = false;
      }
    },
    coverUrl(cover) {
      if (!cover) return '';
      if (/^https?:\/\//i.test(cover)) return cover;
      return typeof this.$withBase === 'function' ? this.$withBase(cover) : cover;
    },
    starText(n) {
      return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    },
    formatRating(n) {
      return Number(n || 0).toFixed(1);
    },
    formatCount(n) {
      return Number(n || 0).toLocaleString('zh-CN');
    },
  },
};
</script>

<style scoped>
.douban-list {
  margin: 24px 0 8px;
  --db-accent: #11a8cd;
  --db-bg: var(--mainBg, #fff);
  --db-border: var(--borderColor, rgba(0, 0, 0, 0.12));
  --db-text: var(--textColor, #2c3e50);
  color: var(--db-text);
}

.db-placeholder {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--textLightenColor, #666);
}

.db-spinner {
  width: 26px;
  height: 26px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--db-accent);
  border-radius: 50%;
  animation: db-spin 0.9s linear infinite;
}
@keyframes db-spin {
  to { transform: rotate(360deg); }
}

.db-header {
  margin-bottom: 16px;
}

.db-title {
  display: flex;
  align-items: center;
  font-size: 20px;
  font-weight: 700;
}

.db-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--db-accent);
  margin-right: 10px;
}

.db-meta {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--textLightenColor, #888);
}
.db-profile-link {
  margin: 0 3px;
  color: var(--db-accent);
  text-decoration: none;
}
.db-profile-link:hover {
  text-decoration: underline;
}

.db-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.db-card {
  display: flex;
  gap: 14px;
  padding: 14px;
  background: var(--db-bg);
  border: 1px solid var(--db-border);
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  text-decoration: none;
  color: inherit;
}
.db-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.12);
}

.db-cover-wrap {
  position: relative;
  flex: 0 0 92px;
  width: 92px;
  height: 132px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.08);
  align-self: flex-start;
}
.db-cover-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  margin: 0;
  border: none;
}

.db-cover-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--textLightenColor, #999);
}

.db-status {
  position: absolute;
  left: 0;
  bottom: 0;
  right: 0;
  padding: 3px 0;
  font-size: 11px;
  text-align: center;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
}

.db-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.db-item-title {
  font-size: 15px;
  line-height: 1.5;
  font-weight: 600;
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.db-intro {
  font-size: 12px;
  color: var(--textLightenColor, #888);
  line-height: 1.5;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.db-rating-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
}

.db-douban-rating {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  color: var(--db-accent);
}
.db-score {
  font-size: 18px;
  font-weight: 700;
}
.db-score-none {
  color: var(--textLightenColor, #999);
}
.db-rating-label {
  color: var(--textLightenColor, #888);
}
.db-count {
  color: var(--textLightenColor, #888);
}

.db-my-rating {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #ff9a2e;
}
.db-stars {
  letter-spacing: 1px;
  font-size: 12px;
}

.db-date {
  margin-left: auto;
  color: var(--textLightenColor, #aaa);
}

.db-comment {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--textColor, #333);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.db-comment-empty {
  margin: 0;
  font-size: 12px;
  color: var(--textLightenColor, #aaa);
}

@media (max-width: 719px) {
  .db-grid {
    grid-template-columns: 1fr;
  }
  .db-cover-wrap {
    flex-basis: 80px;
    width: 80px;
    height: 116px;
  }
}
</style>
