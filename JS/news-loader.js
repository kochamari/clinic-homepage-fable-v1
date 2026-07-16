// お知らせデータを読み込んで表示する機能

// 日付を日本語形式に変換
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

// お知らせをHTMLに変換（ホームページ用）
function createNewsItemHTML(item) {
    return `
        <article class="news-item" data-aos="fade-up" data-aos-delay="100">
            <time class="news-date">${formatDate(item.date)}</time>
            <div class="news-content-wrapper">
                <h3 class="news-title"><a href="news.html#news-${item.id}">${item.title}</a></h3>
                <p class="news-excerpt">${item.excerpt}</p>
            </div>
        </article>
    `;
}

// お知らせ詳細をHTMLに変換（お知らせページ用）
function createNewsDetailHTML(item) {
    const content = item.content.replace(/\n/g, '<br>');
    return `
        <article class="news-article" id="news-${item.id}" data-aos="fade-up">
            <div class="news-header">
                <time class="news-date">${formatDate(item.date)}</time>
                <span class="news-category">${item.category}</span>
            </div>
            <h2 class="news-title">${item.title}</h2>
            <div class="news-content">
                <p>${content}</p>
            </div>
        </article>
    `;
}

// ホームページのお知らせダイジェストを更新
function loadNewsDigest() {
    try {
        // newsDataから直接読み込み
        if (typeof newsData === 'undefined') {
            throw new Error('お知らせデータが見つかりません');
        }
        
        // 最新5件を取得
        const latestNews = newsData.news.slice(0, 5);
        
        // HTMLを生成
        const newsHTML = latestNews.map(item => createNewsItemHTML(item)).join('');
        
        // ページに挿入
        const newsGrid = document.querySelector('.news-digest-grid');
        if (newsGrid) {
            newsGrid.innerHTML = newsHTML;
            // AOSアニメーションを再初期化
            if (typeof AOS !== 'undefined') {
                AOS.refresh();
            }
        }
    } catch (error) {
        console.error('お知らせの読み込みに失敗しました:', error);
        // エラー時の表示
        const newsGrid = document.querySelector('.news-digest-grid');
        if (newsGrid) {
            newsGrid.innerHTML = '<div class="error-message">お知らせを読み込めませんでした。</div>';
        }
    }
}

// お知らせページの全件表示を更新
function loadAllNews() {
    try {
        // newsDataから直接読み込み
        if (typeof newsData === 'undefined') {
            throw new Error('お知らせデータが見つかりません');
        }
        
        // HTMLを生成
        const newsHTML = newsData.news.map(item => createNewsDetailHTML(item)).join('');
        
        // ページに挿入
        const newsContainer = document.querySelector('.news-list');
        if (newsContainer) {
            newsContainer.innerHTML = newsHTML;
            // AOSアニメーションを再初期化
            if (typeof AOS !== 'undefined') {
                AOS.refresh();
            }
        }
    } catch (error) {
        console.error('お知らせの読み込みに失敗しました:', error);
        // エラー時の表示
        const newsContainer = document.querySelector('.news-list');
        if (newsContainer) {
            newsContainer.innerHTML = '<div class="error-message">お知らせを読み込めませんでした。</div>';
        }
    }
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', function() {
    // 公開環境では /news.html が /news のような拡張子なしURLになるため、
    // 最後のパス名から .html を除いてページを判定する
    const pageName = window.location.pathname
        .replace(/\/$/, '')
        .split('/')
        .pop()
        .replace(/\.html$/, '');

    if (pageName === '' || pageName === 'index') {
        // ホームページの場合
        loadNewsDigest();
    } else if (pageName === 'news') {
        // お知らせページの場合
        loadAllNews();
    }
});
