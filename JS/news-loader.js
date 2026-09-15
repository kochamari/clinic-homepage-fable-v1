// お知らせデータを読み込んで表示する機能
// データは JS/news-data.js の newsData から読み込みます（編集方法は「お知らせ編集方法.txt」参照）

// 表示日と掲載期間はポップアップと同じ判定を使う。
function formatDate(dateString) {
    return window.HGCDate ? window.HGCDate.formatDate(dateString) : '';
}

function visibleNewsItems() {
    if (!window.HGCDate || typeof newsData === 'undefined' || !newsData || !Array.isArray(newsData.news)) {
        throw new Error('お知らせの判定データが見つかりません');
    }
    return newsData.news.filter(item => window.HGCDate.visible(item));
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

// 同じ記事のDOMは残す。期限が変わらない更新でフォーカス・スクロールを動かさない。
const newsRenderState = new WeakMap();
function renderNews(host, items, createHTML) {
    const signature = JSON.stringify(items);
    if (newsRenderState.get(host) === signature) return;
    const previous = new Map([...host.children].map(node => [node.dataset.newsId, node]));
    const desired = items.map(item => {
        const key = String(item.id);
        const html = createHTML(item);
        let node = previous.get(key);
        if (!node || node.dataset.newsContent !== JSON.stringify(item)) {
            const template = document.createElement('template');
            template.innerHTML = html.trim();
            node = template.content.firstElementChild;
            node.dataset.newsId = key;
            node.dataset.newsContent = JSON.stringify(item);
            if (node.hasAttribute('data-reveal')) node.classList.add('is-visible');
        }
        return node;
    });
    [...host.children].forEach(node => { if (!desired.includes(node)) node.remove(); });
    desired.forEach((node, index) => {
        if (host.children[index] !== node) host.insertBefore(node, host.children[index] || null);
    });
    newsRenderState.set(host, signature);
}

function loadNews(host, digest) {
    try {
        const items = visibleNewsItems();
        renderNews(host, digest ? items.slice(0, 3) : items, digest ? createNewsItemHTML : createNewsDetailHTML);
    } catch (error) {
        const message = '<p class="error-message">お知らせを読み込めませんでした。</p>';
        if (host.innerHTML !== message) host.innerHTML = message;
        newsRenderState.delete(host);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const digest = document.querySelector('[data-news-digest]');
    const all = document.querySelector('[data-news-all]');
    function refresh() {
        if (digest) loadNews(digest, true);
        if (all) loadNews(all, false);
    }
    if (window.HGCDate) window.HGCDate.watchDay(refresh);
    else refresh();
    // 初回の深いリンクだけ移動する。日付更新やタブ復帰ではスクロールし直さない。
    if (all && window.location.hash) {
        let id = window.location.hash.slice(1);
        try { id = decodeURIComponent(id); } catch (error) { /* そのまま検索する */ }
        const target = document.getElementById(id);
        if (target) target.scrollIntoView();
    }
});
