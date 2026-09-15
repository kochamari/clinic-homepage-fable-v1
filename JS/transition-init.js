// サイト内遷移の到着側レイヤーを、本文が描画される前に準備する。
(function () {
    'use strict';

    // 共通スクリプトはbody末尾にあるため、ここで先に付けないと
    // 本文が一度表示された後にスクロール演出の初期状態へ戻ってしまう。
    document.documentElement.classList.add('js');

    function restoreReadablePage() {
        if (window.hgcScriptReady) return;
        window.hgcMotionFallback = true;
        document.documentElement.classList.remove('js', 'is-entering', 'is-entered', 'is-leaving');
        window.hgcPageEntering = false;
        document.querySelectorAll('.faq-a[hidden]').forEach(answer => { answer.hidden = false; });
    }
    const fallback = setTimeout(restoreReadablePage, 2500);
    document.addEventListener('DOMContentLoaded', () => setTimeout(restoreReadablePage, 0));
    document.addEventListener('hgc:script-ready', () => clearTimeout(fallback), { once: true });
    window.addEventListener('pageshow', restoreReadablePage);

    const quickArrival = /\/access(?:\.html)?$/.test(window.location.pathname) || /^#clinic-(info|calendar)$/.test(window.location.hash);
    if (quickArrival || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    try {
        if (sessionStorage.getItem('hgc-internal-nav')) {
            document.documentElement.classList.add('is-entering');
            window.hgcPageEntering = true;
        }
    } catch (e) {
        // sessionStorage が使えない環境では通常表示に戻す。
    }
})();

// iOS Safariではページ拡大中に、固定配置・マスク画像・視差演出を同時に描画すると
// 描画プロセスが不安定になる場合がある。拡大中だけ装飾を一時停止し、本文の閲覧を優先する。
(function () {
    'use strict';

    const viewport = window.visualViewport;
    if (!viewport) return;

    let zoomed = null;
    let ticking = false;

    function updateZoomState() {
        ticking = false;
        const nextZoomed = viewport.scale > 1.01;
        if (nextZoomed === zoomed) return;
        zoomed = nextZoomed;
        document.documentElement.classList.toggle('is-page-zoomed', nextZoomed);
    }

    function scheduleZoomStateUpdate() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(updateZoomState);
    }

    viewport.addEventListener('resize', scheduleZoomStateUpdate, { passive: true });
    viewport.addEventListener('scroll', scheduleZoomStateUpdate, { passive: true });
    updateZoomState();
})();
