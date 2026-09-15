// 超重要なお知らせをポップアップで出す（トップページのみ）
//
// 出す・出さないは JS/news-data.js 側で決めます。
//   "popup": true              … このお知らせをポップアップで出す
//   "popupUntil": "2026-08-15" … この日まで出す（過ぎたら自動で出なくなる）
//
// 開幕の幕が出ている時は、幕が消えてからポップアップを出します。

(function () {
    'use strict';

    const dismissed = new Set();
    let activePopup = null;
    let pendingTimer = null;
    let curtainTimer = null;
    let curtainListener = null;
    let started = false;

    function pickPopupNews() {
        if (!window.HGCDate || typeof newsData === 'undefined' || !newsData || !Array.isArray(newsData.news)) return null;
        return newsData.news.find(item => window.HGCDate.popupVisible(item) && !dismissed.has(String(item.id))) || null;
    }

    // --- 表示 ---
    function escapeHTML(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDateJP(dateString) {
        return window.HGCDate.formatDate(dateString);
    }

    // 本文を段落に組み直す（空行で段落、単独の改行は <br>）
    function bodyHTML(content) {
        return String(content || '')
            .split('\n\n')
            .map(function (paragraph) {
                return '<p>' + escapeHTML(paragraph).replace(/\n/g, '<br>') + '</p>';
            })
            .join('');
    }

    function show(item) {
        const overlay = document.createElement('div');
        overlay.className = 'news-popup';
        overlay.innerHTML =
            '<div class="news-popup-backdrop" data-popup-close></div>' +
            '<div class="news-popup-panel" role="dialog" aria-modal="true" aria-labelledby="news-popup-title">' +
                '<button type="button" class="news-popup-close" data-popup-close aria-label="閉じる">' +
                    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
                        '<path d="M18 6 6 18M6 6l12 12"/>' +
                    '</svg>' +
                '</button>' +
                '<div class="news-popup-meta">' +
                    '<span class="news-popup-chip">' + escapeHTML(item.category || 'お知らせ') + '</span>' +
                    '<time datetime="' + escapeHTML(item.date) + '">' + formatDateJP(item.date) + '</time>' +
                '</div>' +
                '<h2 class="news-popup-title" id="news-popup-title">' + escapeHTML(item.title) + '</h2>' +
                '<div class="news-popup-body">' + bodyHTML(item.content) + '</div>' +
                '<div class="news-popup-actions">' +
                    '<button type="button" class="btn btn-primary" data-popup-close>閉じる</button>' +
                    '<a class="btn btn-ghost" href="news#news-' + escapeHTML(item.id) + '">お知らせ一覧を見る</a>' +
                '</div>' +
            '</div>';

        const lastFocused = document.activeElement;
        let closed = false;

        function close(remember = true) {
            if (closed) return;
            closed = true;
            if (remember) dismissed.add(String(item.id));
            activePopup = null;
            overlay.classList.remove('is-open');
            document.documentElement.classList.remove('is-popup-open');
            document.removeEventListener('keydown', onKeydown);
            setTimeout(function () { overlay.remove(); }, 400);
            // 元々フォーカスがあった場所へ戻す
            if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.isConnected && lastFocused.focus({ preventScroll: true });
        }

        function onKeydown(e) {
            if (e.key === 'Escape') {
                close();
                return;
            }
            // ポップアップの外へフォーカスが逃げないようにする
            if (e.key !== 'Tab') return;
            const focusables = overlay.querySelectorAll('button, a[href]');
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }

        overlay.addEventListener('click', function (e) {
            if (e.target.closest('[data-popup-close]')) close();
        });
        document.addEventListener('keydown', onKeydown);

        document.body.appendChild(overlay);
        document.documentElement.classList.add('is-popup-open');
        // 位置を確定させてから開く。こうしないと、ふわっと出るアニメーションが働かない
        // （requestAnimationFrame は裏に回ったタブでは動かないので、こちらを使う）
        void overlay.offsetWidth;
        overlay.classList.add('is-open');
        const closeBtn = overlay.querySelector('.news-popup-close');
        if (closeBtn) closeBtn.focus({ preventScroll: true });
        activePopup = { item, close };
    }

    function cancelPending() {
        clearTimeout(pendingTimer);
        clearTimeout(curtainTimer);
        if (curtainListener) document.removeEventListener('hgc:curtain-end', curtainListener);
        pendingTimer = curtainTimer = curtainListener = null;
    }

    // 遅延中に深夜を越えた場合も、表示直前の条件で選び直す。
    function showCurrent() {
        cancelPending();
        if (document.hidden || activePopup) return;
        const item = pickPopupNews();
        if (item) show(item);
    }

    function refresh() {
        if (activePopup && !window.HGCDate.popupVisible(activePopup.item)) activePopup.close(false);
        cancelPending();
        if (activePopup || document.hidden || !pickPopupNews()) return;
        if (window.hgcCurtainPending) {
            curtainListener = function () {
                cancelPending();
                pendingTimer = setTimeout(showCurrent, 320);
            };
            document.addEventListener('hgc:curtain-end', curtainListener);
            curtainTimer = setTimeout(curtainListener, 15000);
        } else {
            pendingTimer = setTimeout(showCurrent, 600);
        }
    }

    function start() {
        if (started || !window.HGCDate) return;
        if (!['/', '/index', '/index.html'].includes(window.location.pathname)) return;
        if (window.hgcFreshVisit === false) return;
        started = true;
        window.HGCDate.watchDay(refresh);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
