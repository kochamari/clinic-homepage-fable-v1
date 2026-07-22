// 原口消化器内科 — サイト共通スクリプト
// 1. 開幕演出（ページを開くたび）
// 2. パララックス背景 / 和紙の質感 / 縦書きラベル
// 3. モバイルドロワーメニュー
// 4. ヘッダーのスクロール状態
// 5. スクロール連動の表示アニメーション（IntersectionObserver）

document.documentElement.classList.add('js');

// --- サイト内リンクをたどったかどうかの印 ---
// ファイルを直接開いた場合（file://）ブラウザは参照元を教えてくれないので、
// リンクを押した時に自分で印を残し、次のページでそれを読んで判断する。
const NAV_FLAG = 'hgc-internal-nav';

function markInternalNav() {
    try { sessionStorage.setItem(NAV_FLAG, '1'); } catch (e) { /* 使えない環境もある */ }
    // window.name はタブ内のページ移動をまたいで残るので、file:// でも確実に効く
    try { window.name = NAV_FLAG; } catch (e) { /* noop */ }
}

// 印を読み取り、同時に消す（読み捨て）
const cameFromInsideSite = (function () {
    let found = false;
    try {
        if (sessionStorage.getItem(NAV_FLAG)) {
            found = true;
            sessionStorage.removeItem(NAV_FLAG);
        }
    } catch (e) { /* noop */ }
    try {
        if (window.name === NAV_FLAG) {
            found = true;
            window.name = '';
        }
    } catch (e) { /* noop */ }
    return found;
})();

// --- 開幕演出 ---
// トップページを「直接」開いた時だけ表示する（初回アクセス・リロード・ブックマーク等）。
// サイト内の他ページから移動してきた場合は出さない。
// DOMContentLoaded を待たずに幕を出して、中身のちらつきを防ぐ
(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // トップページ以外では出さない
    const file = window.location.pathname.split('/').pop().replace(/\.html$/, '');
    if (file !== '' && file !== 'index') return;

    // サイト内の別ページから移動してきた場合は出さない
    if (cameFromInsideSite) return;

    const curtain = document.createElement('div');
    curtain.className = 'curtain';
    curtain.setAttribute('aria-hidden', 'true');
    curtain.innerHTML =
        '<div class="curtain-inner">' +
            '<img class="curtain-mark" src="images/logo.PNG" alt="">' +
            '<span class="curtain-name">原口消化器内科</span>' +
        '</div>';

    function mount() {
        document.body.appendChild(curtain);
        document.documentElement.classList.add('is-curtain');
        requestAnimationFrame(function () {
            curtain.classList.add('is-shown');
        });

        let done = false;
        let pulled = 0;          // めくり上げた量（px）。スクロール量と1対1で対応する
        let autoTimer = null;

        // 画面のこれだけスクロールすると、幕が完全に透けきる
        function fadeDistance() {
            return (window.innerHeight || 800) * 0.55;
        }

        // 今のめくり量を画面に反映する。戻り値は残っている濃さ
        function render() {
            const opacity = Math.max(0, 1 - pulled / fadeDistance());
            curtain.style.transform = 'translateY(-' + Math.round(pulled) + 'px)';
            curtain.style.opacity = String(opacity);
            return opacity;
        }

        function cleanup() {
            clearTimeout(autoTimer);
            window.removeEventListener('wheel', onWheel);
            curtain.removeEventListener('touchstart', onTouchStart);
            curtain.removeEventListener('touchmove', onTouchMove);
            document.documentElement.classList.remove('is-curtain');
        }

        // めくりきって見えなくなった時（すでに透明なので、そのまま片付ける）
        function finish() {
            if (done) return;
            done = true;
            cleanup();
            curtain.remove();
        }

        // 何もしなかった時・クリックされた時：その場でふわっと消える
        function fadeOut() {
            if (done) return;
            done = true;
            cleanup();
            curtain.classList.remove('is-pulling');
            curtain.classList.add('is-lifting');
            curtain.style.opacity = '0';
            setTimeout(function () { curtain.remove(); }, 2000);
        }

        // スクロール量ぶんだけ、そのままめくる（マイナスなら戻る）
        function pullBy(delta) {
            if (done) return;
            clearTimeout(autoTimer);        // 触り始めたら、自動で消すのはやめる
            curtain.classList.add('is-pulling');
            pulled = Math.max(0, pulled + delta);
            if (render() <= 0.005) finish();   // 小数の誤差でわずかに残るのを防ぐ
        }

        function onWheel(e) {
            if (done) return;
            if (e.ctrlKey || e.metaKey) return;   // 拡大縮小は邪魔しない
            e.preventDefault();
            pullBy(e.deltaY);   // 下へスクロールでめくれ、上へスクロールで戻る
        }

        let touchStartY = 0;
        let touchBase = 0;
        function onTouchStart(e) {
            touchStartY = e.touches[0].clientY;
            touchBase = pulled;
        }
        function onTouchMove(e) {
            if (done) return;
            e.preventDefault();
            const dy = touchStartY - e.touches[0].clientY;  // 上へスワイプすると正
            clearTimeout(autoTimer);
            curtain.classList.add('is-pulling');
            pulled = Math.max(0, touchBase + dy);
            if (render() <= 0.005) finish();   // 小数の誤差でわずかに残るのを防ぐ
        }

        window.addEventListener('wheel', onWheel, { passive: false });
        curtain.addEventListener('touchstart', onTouchStart, { passive: true });
        curtain.addEventListener('touchmove', onTouchMove, { passive: false });

        // 何もしなければ4秒ほど見せてから、ふわっと消える
        autoTimer = setTimeout(fadeOut, 4000);
        // クリックやキー操作でいつでも飛ばせる
        curtain.addEventListener('click', fadeOut);
        window.addEventListener('keydown', fadeOut, { once: true });
    }

    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
})();

// サイト内のページへ移動するリンクを押したら印を残す
// （次のページで「他ページから来た」と判断できるようにするため）
document.addEventListener('click', function (e) {
    const link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;
    // ページ内リンク・電話・メール・別タブで開くものは対象外
    if (href.charAt(0) === '#') return;
    if (/^(tel:|mailto:|javascript:)/i.test(href)) return;
    if (link.target && link.target !== '_self') return;

    // 同じサイト内のページへの移動だけを対象にする
    if (/^https?:\/\//i.test(href)) {
        try {
            if (new URL(href).origin !== window.location.origin) return;
        } catch (err) { return; }
    }

    markInternalNav();
}, true);

document.addEventListener('DOMContentLoaded', function () {
    // --- 和紙の質感（画面全体にごく薄いノイズを重ねる。動かない） ---
    const grain = document.createElement('div');
    grain.className = 'grain';
    grain.setAttribute('aria-hidden', 'true');
    document.body.appendChild(grain);

    // --- 画面左端の縦書きラベル（広い画面でのみ表示） ---
    const sideLabel = document.createElement('div');
    sideLabel.className = 'side-label';
    sideLabel.setAttribute('aria-hidden', 'true');
    sideLabel.textContent = 'HARAGUCHI GASTROENTEROLOGY — SASEBO';
    document.body.appendChild(sideLabel);

    // --- パララックス背景 ---
    // 奥行きの異なる複数レイヤーを body 先頭に挿入し、
    // スクロール量とマウス位置に応じて別々の速度で動かして立体感を出す。
    const parallaxBg = document.createElement('div');
    parallaxBg.className = 'parallax-bg';
    parallaxBg.setAttribute('aria-hidden', 'true');
    parallaxBg.innerHTML =
        '<div class="parallax-layer parallax-layer--orbs">' +
            '<span class="p-orb p-orb--1"></span>' +
            '<span class="p-orb p-orb--2"></span>' +
            '<span class="p-orb p-orb--3"></span>' +
        '</div>' +
        '<div class="parallax-layer parallax-layer--dots"></div>' +
        '<div class="parallax-layer parallax-layer--rings"><div class="rings-inner"></div></div>' +
        '<div class="parallax-glow"></div>';
    document.body.prepend(parallaxBg);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!prefersReducedMotion.matches) {
        const orbsLayer = parallaxBg.querySelector('.parallax-layer--orbs');
        const dotsLayer = parallaxBg.querySelector('.parallax-layer--dots');
        const ringsLayer = parallaxBg.querySelector('.parallax-layer--rings');
        const glow = parallaxBg.querySelector('.parallax-glow');

        let scrollY = window.scrollY;
        // マウス位置は中心を0とした -1〜1。target に向けて毎フレーム少しずつ近づけ、動きを滑らかにする
        let pointerX = 0, pointerY = 0;
        let targetPX = 0, targetPY = 0;
        let glowX = window.innerWidth / 2, glowY = window.innerHeight / 2;
        let rafPending = false;

        function render() {
            rafPending = false;
            const y = scrollY;
            const vh = window.innerHeight;
            pointerX += (targetPX - pointerX) * 0.08;
            pointerY += (targetPY - pointerY) * 0.08;

            // 奥ほど遅く、手前ほど速く／マウスにも手前ほど大きく反応させる
            const orbsY = -Math.min(y * 0.05, vh * 0.6);
            orbsLayer.style.transform =
                'translate3d(' + (pointerX * 10).toFixed(1) + 'px, ' + (orbsY + pointerY * 10).toFixed(1) + 'px, 0)';

            const dotsY = -((y * 0.14) % 26);
            dotsLayer.style.transform =
                'translate3d(' + (pointerX * 16).toFixed(1) + 'px, ' + (dotsY + pointerY * 16).toFixed(1) + 'px, 0)';

            const ringsY = -Math.min(y * 0.10, vh * 0.6);
            ringsLayer.style.transform =
                'translate3d(' + (pointerX * 26).toFixed(1) + 'px, ' + (ringsY + pointerY * 26).toFixed(1) + 'px, 0)';

            glow.style.transform =
                'translate3d(' + glowX.toFixed(1) + 'px, ' + glowY.toFixed(1) + 'px, 0)';

            // マウス位置がまだ目標に追いついていなければ、次のフレームも描画する
            if (Math.abs(targetPX - pointerX) > 0.0005 || Math.abs(targetPY - pointerY) > 0.0005) {
                schedule();
            }
        }

        function schedule() {
            if (!rafPending) {
                rafPending = true;
                requestAnimationFrame(render);
            }
        }

        window.addEventListener('scroll', function () {
            scrollY = window.scrollY;
            schedule();
        }, { passive: true });

        // マウスのある PC のみ、視差とスポットライトを有効にする
        if (window.matchMedia('(pointer: fine)').matches) {
            window.addEventListener('pointermove', function (e) {
                targetPX = (e.clientX / window.innerWidth - 0.5) * 2;
                targetPY = (e.clientY / window.innerHeight - 0.5) * 2;
                glowX = e.clientX;
                glowY = e.clientY;
                glow.style.opacity = '1';
                schedule();
            }, { passive: true });

            document.addEventListener('mouseleave', function () {
                targetPX = 0;
                targetPY = 0;
                glow.style.opacity = '0';
                schedule();
            });
        }

        render();
    }

    // --- モバイルドロワーメニュー ---
    const navToggle = document.querySelector('.nav-toggle');
    const drawer = document.getElementById('site-drawer');

    if (navToggle && drawer) {
        function openDrawer() {
            navToggle.setAttribute('aria-expanded', 'true');
            drawer.classList.add('is-open');
            document.body.classList.add('drawer-open');
        }

        function closeDrawer() {
            navToggle.setAttribute('aria-expanded', 'false');
            drawer.classList.remove('is-open');
            document.body.classList.remove('drawer-open');
        }

        navToggle.addEventListener('click', function () {
            if (drawer.classList.contains('is-open')) {
                closeDrawer();
            } else {
                openDrawer();
            }
        });

        drawer.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', closeDrawer);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
                closeDrawer();
                navToggle.focus();
            }
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth > 960 && drawer.classList.contains('is-open')) {
                closeDrawer();
            }
        });
    }

    // --- ヘッダーのスクロール状態 ---
    const header = document.querySelector('.site-header');
    if (header) {
        function updateHeader() {
            header.classList.toggle('is-scrolled', window.scrollY > 20);
        }
        window.addEventListener('scroll', updateHeader, { passive: true });
        updateHeader();
    }

    // --- スクロール進捗バー ---
    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    progress.innerHTML = '<span></span>';
    document.body.appendChild(progress);
    const progressBar = progress.firstElementChild;
    let progressTicking = false;

    function updateProgress() {
        progressTicking = false;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
        progressBar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
    }

    window.addEventListener('scroll', function () {
        if (!progressTicking) {
            progressTicking = true;
            requestAnimationFrame(updateProgress);
        }
    }, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
    updateProgress();

    // --- 大見出しの文字送り（スクロールで到達した時に一度だけ） ---
    // 1文字ずつ「窓（.char）」で包み、その中身（.char-inner）を下からせり上げる。
    // 暖簾をくぐるように文字が現れる、和の落ち着いた見せ方。
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // 行頭に来てはいけない文字（句読点や閉じ括弧、小書き文字など）。
        // これらは直前の文字と同じ「窓」に入れて、行頭に落ちないようにする
        const NO_LINE_START = '、。，．・：；！？）」』】〕｝》〉ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヵヶ々〜';

        document.querySelectorAll('.hero-title, .page-hero-title, .statement-title')
            .forEach(function (heading) {
                const nodes = Array.prototype.slice.call(heading.childNodes);
                const frag = document.createDocumentFragment();
                let index = 0;
                let lastInner = null;

                nodes.forEach(function (node) {
                    if (node.nodeType === 3) {
                        node.textContent.split('').forEach(function (ch) {
                            if (ch.trim() === '') {
                                frag.appendChild(document.createTextNode(ch));
                                lastInner = null;
                                return;
                            }
                            // 句読点などは直前の文字にくっつける（禁則処理）
                            if (lastInner && NO_LINE_START.indexOf(ch) !== -1) {
                                lastInner.textContent += ch;
                                return;
                            }
                            const mask = document.createElement('span');
                            mask.className = 'char';
                            const inner = document.createElement('span');
                            inner.className = 'char-inner';
                            inner.textContent = ch;
                            inner.style.transitionDelay = (index * 0.045).toFixed(3) + 's';
                            index++;
                            mask.appendChild(inner);
                            frag.appendChild(mask);
                            lastInner = inner;
                        });
                    } else {
                        // <br> などはそのまま残して改行位置を保つ
                        frag.appendChild(node.cloneNode(true));
                        lastInner = null;
                    }
                });

                heading.innerHTML = '';
                heading.appendChild(frag);
                heading.classList.add('split-text');
            });
    }

    // --- カードのホバー光沢（カーソル位置に淡い光を差す） ---
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        // 光沢はクリックできるカード（トップの「こんなときは、当院へ」）だけ
        document.querySelectorAll('.segment-card')
            .forEach(function (card) {
                card.addEventListener('pointermove', function (e) {
                    const rect = card.getBoundingClientRect();
                    card.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
                    card.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
                }, { passive: true });
            });
    }

    // --- スクロール連動アニメーション ---
    const revealTargets = document.querySelectorAll('[data-reveal], .split-text');
    if (revealTargets.length > 0 && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
        );
        revealTargets.forEach(function (el) {
            observer.observe(el);
        });
    } else {
        revealTargets.forEach(function (el) {
            el.classList.add('is-visible');
        });
    }
});
