// 超重要なお知らせをポップアップで出す（トップページのみ）
//
// 出す・出さないは JS/news-data.js 側で決めます。
//   "popup": true              … このお知らせをポップアップで出す
//   "popupUntil": "2026-08-15" … この日まで出す（過ぎたら自動で出なくなる）
//
// 開幕の幕が出ている時は、幕が消えてからポップアップを出します。

(function () {
    'use strict';

    // --- 出すお知らせを1件選ぶ ---
    function pickPopupNews() {
        if (typeof newsData === 'undefined' || !newsData || !Array.isArray(newsData.news)) return null;

        // 「今日」を 0時ちょうどにそろえて、日付だけで比べられるようにする
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < newsData.news.length; i++) {
            const item = newsData.news[i];
            if (!item || item.popup !== true) continue;

            // 掲載期限が指定されていれば、その日を過ぎていないか確かめる
            if (item.popupUntil) {
                // 「2026-08-15」を、その土地の時刻としてそのまま読む。
                // new Date('2026-08-15') は世界標準時と見なされ、日付が1日ずれることがあるため。
                const parts = String(item.popupUntil).split('-');
                if (parts.length !== 3) continue;          // 日付の書き方が違う時は出さない
                const until = new Date(
                    Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]),
                    23, 59, 59, 999                        // 指定日の終わりまでは出す
                );
                if (isNaN(until.getTime())) continue;
                if (today > until) continue;
            }
            return item;
        }
        return null;
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
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return date.getFullYear() + '.' +
            String(date.getMonth() + 1).padStart(2, '0') + '.' +
            String(date.getDate()).padStart(2, '0');
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
                    '<a class="btn btn-ghost" href="news.html#news-' + escapeHTML(item.id) + '">お知らせ一覧を見る</a>' +
                '</div>' +
            '</div>';

        const lastFocused = document.activeElement;
        let closed = false;

        function close() {
            if (closed) return;
            closed = true;
            overlay.classList.remove('is-open');
            document.documentElement.classList.remove('is-popup-open');
            document.removeEventListener('keydown', onKeydown);
            setTimeout(function () { overlay.remove(); }, 400);
            // 元々フォーカスがあった場所へ戻す
            if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
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
        if (closeBtn) closeBtn.focus();
    }

    // --- いつ出すか ---
    function start() {
        // トップページ以外では出さない
        const page = window.location.pathname.replace(/\/$/, '').split('/').pop().replace(/\.html$/, '');
        if (page !== '' && page !== 'index') return;

        // トップページを直接開いた時だけ出す。
        // サイト内の他ページから戻ってきた時に毎回出ると、わずらわしいため。
        if (window.hgcFreshVisit === false) return;

        const item = pickPopupNews();
        if (!item) return;

        // 幕が出ている間は待って、消えてから少し間をおいて出す
        if (window.hgcCurtainPending) {
            let fired = false;
            const open = function () {
                if (fired) return;
                fired = true;
                document.removeEventListener('hgc:curtain-end', open);
                setTimeout(function () { show(item); }, 320);
            };
            document.addEventListener('hgc:curtain-end', open);
            // 万一、幕の終わりを受け取れなかった時の保険
            setTimeout(open, 15000);
            return;
        }

        // 幕が出ない時（動きを減らす設定など）は、そのまま少し待って出す
        setTimeout(function () { show(item); }, 600);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
