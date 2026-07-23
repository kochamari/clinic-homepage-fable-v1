// サイト内遷移の到着側レイヤーを、本文が描画される前に準備する。
(function () {
    'use strict';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    try {
        if (sessionStorage.getItem('hgc-internal-nav')) {
            document.documentElement.classList.add('is-entering');
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

    function updateZoomState() {
        document.documentElement.classList.toggle('is-page-zoomed', viewport.scale > 1.01);
    }

    viewport.addEventListener('resize', updateZoomState, { passive: true });
    viewport.addEventListener('scroll', updateZoomState, { passive: true });
    updateZoomState();
})();
