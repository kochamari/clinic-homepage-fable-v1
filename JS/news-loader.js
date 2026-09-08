// お知らせデータを読み込んで表示する機能
// データは JS/news-data.js の newsData から読み込みます（編集方法は「お知らせ編集方法.txt」参照）

// 日付を「2025.06.06」形式に変換
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

// 日本時間の「YYYY-MM-DD」を返す（期間限定のお知らせ判定用）
function newsTodayKeyInTokyo() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const values = {};
    parts.forEach(part => {
        if (part.type !== 'literal') values[part.type] = part.value;
    });
    return `${values.year}-${values.month}-${values.day}`;
}

// displayFrom / displayUntil が指定されたお知らせは、その期間だけ表示する。
// 日付は両端を含むため、displayUntil の翌日 0:00（日本時間）から自動で非表示になる。
function visibleNewsItems() {
    const today = newsTodayKeyInTokyo();
    return newsData.news.filter(item => {
        if (item.displayFrom && today < item.displayFrom) return false;
        if (item.displayUntil && today > item.displayUntil) return false;
        return true;
    });
}

// カテゴリに応じたラベルの色分けクラス
function categoryClass(category) {
    if (category === '重要') return 'news-chip news-chip--important';
    if (category === 'ワクチン') return 'news-chip news-chip--vaccine';
    return 'news-chip';
}

// お知らせ1件分のHTML（ホームのダイジェスト用）
function createNewsItemHTML(item) {
    return `
        <a class="news-row" href="news#news-${item.id}">
            <time class="news-row-date" datetime="${item.date}">${formatDate(item.date)}</time>
            <span class="${categoryClass(item.category)}">${item.category}</span>
            <span class="news-row-title">${item.title}</span>
        </a>
    `;
}

// お知らせ詳細のHTML（お知らせページ用）
function createNewsDetailHTML(item) {
    const content = item.content
        .split('\n\n')
        .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
        .join('');
    return `
        <article class="news-article" id="news-${item.id}" data-reveal>
            <div class="news-article-meta">
                <time datetime="${item.date}">${formatDate(item.date)}</time>
                <span class="${categoryClass(item.category)}">${item.category}</span>
            </div>
            <h2 class="news-article-title">${item.title}</h2>
            <div class="news-article-body">${content}</div>
        </article>
    `;
}

// ホームページのお知らせダイジェストを更新（最新3件）
function loadNewsDigest() {
    const newsGrid = document.querySelector('.news-list[data-news-digest]');
    if (!newsGrid) return;
    try {
        if (typeof newsData === 'undefined') {
            throw new Error('お知らせデータが見つかりません');
        }
        const latestNews = visibleNewsItems().slice(0, 3);
        newsGrid.innerHTML = latestNews.map(createNewsItemHTML).join('');
    } catch (error) {
        console.error('お知らせの読み込みに失敗しました:', error);
        newsGrid.innerHTML = '<div class="error-message">お知らせを読み込めませんでした。</div>';
    }
}

// お知らせページの全件表示を更新
function loadAllNews() {
    const newsContainer = document.querySelector('[data-news-all]');
    if (!newsContainer) return;
    try {
        if (typeof newsData === 'undefined') {
            throw new Error('お知らせデータが見つかりません');
        }
        newsContainer.innerHTML = visibleNewsItems().map(createNewsDetailHTML).join('');
        // 動的に追加した要素にも表示アニメーションを適用
        newsContainer.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
        // ハッシュ付きURL（news#news-9 など）で直接開かれた場合のスクロール
        if (window.location.hash) {
            let id = window.location.hash.slice(1);
            try { id = decodeURIComponent(id); } catch (error) { /* 不正な文字はそのまま検索する */ }
            const target = document.getElementById(id);
            if (target) target.scrollIntoView();
        }
    } catch (error) {
        console.error('お知らせの読み込みに失敗しました:', error);
        newsContainer.innerHTML = '<div class="error-message">お知らせを読み込めませんでした。</div>';
    }
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', function () {
    // 公開環境では /news.html が /news にリダイレクトされるため、
    // 最後のパス名から .html を除いてページを判定する
    const pageName = window.location.pathname
        .replace(/\/$/, '')
        .split('/')
        .pop()
        .replace(/\.html$/, '');

    if (pageName === '' || pageName === 'index') {
        loadNewsDigest();
    } else if (pageName === 'news') {
        loadAllNews();
    }
});
