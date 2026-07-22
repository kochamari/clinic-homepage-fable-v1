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

// カテゴリに応じたラベルの色分けクラス
function categoryClass(category) {
    if (category === '重要') return 'news-chip news-chip--important';
    if (category === 'ワクチン') return 'news-chip news-chip--vaccine';
    return 'news-chip';
}

// お知らせ1件分のHTML（ホームのダイジェスト用）
function createNewsItemHTML(item) {
    return `
        <a class="news-row" href="news.html#news-${item.id}">
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
        const latestNews = newsData.news.slice(0, 3);
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
        newsContainer.innerHTML = newsData.news.map(createNewsDetailHTML).join('');
        // 動的に追加した要素にも表示アニメーションを適用
        newsContainer.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
        // ハッシュ付きURL（news.html#news-9 など）で直接開かれた場合のスクロール
        if (window.location.hash) {
            const target = document.querySelector(window.location.hash);
            if (target) target.scrollIntoView();
        }
    } catch (error) {
        console.error('お知らせの読み込みに失敗しました:', error);
        newsContainer.innerHTML = '<div class="error-message">お知らせを読み込めませんでした。</div>';
    }
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', function () {
    // 公開環境では /news.html が /news のような拡張子なしURLになるため、
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
