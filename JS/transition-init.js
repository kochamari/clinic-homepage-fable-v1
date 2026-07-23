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
