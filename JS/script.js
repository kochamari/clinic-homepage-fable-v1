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

// このページを「直接」開いたか（初回アクセス・リロード・ブックマーク等）。
// 開幕演出と、重要なお知らせのポップアップは、この時だけ出す。
window.hgcFreshVisit = !cameFromInsideSite;

// サイト内遷移で到着したページは、出発側と同じ紙色レイヤーから表示する。
// transition-init.js が描画前に付けたクラスを、描画後にゆっくり解除する。
if (cameFromInsideSite && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('is-entering');
    window.hgcPageEntering = true;
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            document.documentElement.classList.add('is-entered');
            setTimeout(function () {
                document.documentElement.classList.remove('is-entering', 'is-entered');
                window.hgcPageEntering = false;
                document.dispatchEvent(new CustomEvent('hgc:page-entered'));
            }, 620);
        });
    });
}

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

    // 幕を出すことが決まった。お知らせのポップアップは、幕が消えてから出す
    window.hgcCurtainPending = true;

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

        // 幕を取り払い、「幕が消えた」と知らせる（お知らせのポップアップ用）
        function removeCurtain() {
            curtain.remove();
            window.hgcCurtainPending = false;
            document.dispatchEvent(new CustomEvent('hgc:curtain-end'));
        }

        function cleanup() {
            clearTimeout(autoTimer);
            window.removeEventListener('wheel', onWheel);
            curtain.removeEventListener('touchstart', onTouchStart);
            curtain.removeEventListener('touchmove', onTouchMove);
            curtain.removeEventListener('touchend', onTouchEnd);
            curtain.removeEventListener('touchcancel', onTouchEnd);
            document.documentElement.classList.remove('is-curtain');
        }

        // めくりきって見えなくなった時（すでに透明なので、そのまま片付ける）
        function finish() {
            if (done) return;
            done = true;
            cleanup();
            removeCurtain();
        }

        // 何もしなかった時・クリックされた時：その場でふわっと消える
        function fadeOut() {
            if (done) return;
            done = true;
            cleanup();
            curtain.classList.remove('is-pulling');
            curtain.classList.add('is-lifting');
            curtain.style.opacity = '0';
            setTimeout(removeCurtain, 2000);
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

        // --- スマホ（指で操作する場合） ---
        // 指を動かしている間は追従し、離した時に残りを自動で巻き上げる。
        // ほとんど動かさずに離した時は、元の位置に戻す。
        const TOUCH_COMMIT = 40;   // これだけスワイプしていれば、あとは自動で巻き上げる

        // 残りを自動で巻き上げて消す
        function autoLift() {
            if (done) return;
            done = true;
            cleanup();
            curtain.classList.remove('is-pulling');
            curtain.classList.add('is-lifting', 'is-auto-lifting');
            curtain.style.transform = 'translateY(-' + Math.round(window.innerHeight) + 'px)';
            curtain.style.opacity = '0';
            setTimeout(removeCurtain, 1600);
        }

        // 元の位置へ戻す
        function snapBack() {
            pulled = 0;
            curtain.classList.remove('is-pulling');
            curtain.classList.add('is-returning');
            curtain.style.transform = 'translateY(0)';
            curtain.style.opacity = '1';
            // 戻したまま放置されないよう、自動で消すタイマーをかけ直す
            clearTimeout(autoTimer);
            autoTimer = setTimeout(fadeOut, 4000);
        }

        let touchStartY = 0;
        let touchBase = 0;
        function onTouchStart(e) {
            touchStartY = e.touches[0].clientY;
            touchBase = pulled;
            curtain.classList.remove('is-returning');
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
        function onTouchEnd() {
            if (done) return;
            if (pulled >= TOUCH_COMMIT) autoLift();
            else snapBack();
        }

        window.addEventListener('wheel', onWheel, { passive: false });
        curtain.addEventListener('touchstart', onTouchStart, { passive: true });
        curtain.addEventListener('touchmove', onTouchMove, { passive: false });
        curtain.addEventListener('touchend', onTouchEnd, { passive: true });
        curtain.addEventListener('touchcancel', onTouchEnd, { passive: true });

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
    if (link.hasAttribute('download')) return;

    // 同じサイト内のページへの移動だけを対象にする
    if (/^https?:\/\//i.test(href)) {
        try {
            if (new URL(href).origin !== window.location.origin) return;
        } catch (err) { return; }
    }

    // 紙色のレイヤーで画面をつなげてから移動する（修飾クリックはそのまま）
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.defaultPrevented) return;

    // 現在表示しているページへのリンクでは、Safariに不要な再読み込みをさせない。
    // とくにモバイルで拡大操作の直後に現在地リンクが反応すると、再読み込みが重なることがある。
    if (link.href === window.location.href) {
        e.preventDefault();
        return;
    }

    markInternalNav();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    e.preventDefault();
    if (document.documentElement.classList.contains('is-leaving')) return;
    document.documentElement.classList.add('is-leaving');
    setTimeout(function () {
        window.location.href = link.href;
    }, 420);
}, true);

// 「戻る」でキャッシュから復帰した時に、暗転したまま残らないようにする
window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    document.documentElement.classList.remove('is-leaving', 'is-entering', 'is-entered');
    window.hgcPageEntering = false;
    document.dispatchEvent(new CustomEvent('hgc:page-entered'));
});

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

    // --- 検査一覧の開閉 ---
    // details の標準動作は高さが一瞬で切り替わるため、外枠の高さを明示的に補間する。
    // 開く時も閉じる時も、内容量にかかわらず同じ穏やかなテンポで動かす。
    document.querySelectorAll('.examinations-disclosure').forEach(function (details) {
        const summary = details.querySelector('summary');
        if (!summary) return;

        const duration = 1350;
        let fallbackTimer = 0;
        let heightBeforeToggle = 0;

        function finishAnimation() {
            clearTimeout(fallbackTimer);
            details.style.height = '';
            details.classList.remove('is-height-animating');
        }

        function waitForHeightTransition() {
            let finished = false;
            const finish = function () {
                if (finished) return;
                finished = true;
                details.removeEventListener('transitionend', onTransitionEnd);
                finishAnimation();
            };
            const onTransitionEnd = function (event) {
                if (event.target === details && event.propertyName === 'height') finish();
            };

            details.addEventListener('transitionend', onTransitionEnd);
            fallbackTimer = window.setTimeout(finish, duration + 180);
        }

        function rememberCurrentHeight() {
            if (details.classList.contains('is-height-animating')) return;
            heightBeforeToggle = details.getBoundingClientRect().height;
        }

        // pointerdown / keydown の時点なら、ブラウザが details を切り替える直前の高さを取得できる。
        summary.addEventListener('pointerdown', rememberCurrentHeight);
        summary.addEventListener('mousedown', rememberCurrentHeight);
        summary.addEventListener('touchstart', rememberCurrentHeight, { passive: true });
        // 一部のブラウザや補助操作は pointerdown を通らないため、click の捕捉段階も保険にする。
        summary.addEventListener('click', rememberCurrentHeight, true);
        summary.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') rememberCurrentHeight();
        });

        details.addEventListener('toggle', function () {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return;
            }
            const endHeight = details.getBoundingClientRect().height;
            const startHeight = heightBeforeToggle || endHeight;
            heightBeforeToggle = 0;
            if (Math.abs(endHeight - startHeight) < 2) return;

            details.classList.add('is-height-animating');
            // 標準の開閉が画面に描かれる前に、開閉前の高さへ戻してから終点へ向かわせる。
            // 始点を置く一瞬だけ transition を止め、auto 高さからの補間で終点へ跳ねないようにする。
            details.style.transition = 'none';
            details.style.height = startHeight + 'px';
            void details.offsetHeight;
            details.style.transition = '';
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    details.style.height = endHeight + 'px';
                });
            });
            waitForHeightTransition();
        });
    });

    // --- パララックス背景 ---
    // 奥行きの異なる複数レイヤーを body 先頭に挿入し、
    // スクロール量とマウス位置に応じて別々の速度で動かして立体感を出す。
    const parallaxBg = document.createElement('div');
    parallaxBg.className = 'parallax-bg';
    parallaxBg.setAttribute('aria-hidden', 'true');
    // 院内サインの透かしはトップページだけに置く
    const isHomePage = (function () {
        const page = window.location.pathname
            .replace(/\/$/, '').split('/').pop().replace(/\.html$/, '');
        return page === '' || page === 'index';
    })();

    parallaxBg.innerHTML =
        '<div class="parallax-layer parallax-layer--leaves">' +
            '<span class="p-leaf p-leaf--1"></span>' +
            '<span class="p-leaf p-leaf--2"></span>' +
            (isHomePage ? '<span class="p-sign"><span class="p-sign-img"></span></span>' : '') +
        '</div>' +
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
    // 指で操作する端末では、拡大時のSafari描画負荷を抑えるため視差の継続描画を行わない。
    const canUseParallaxMotion =
        !prefersReducedMotion.matches &&
        window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const canUseMobileParallax =
        !prefersReducedMotion.matches &&
        window.matchMedia('(hover: none), (pointer: coarse)').matches;

    if (canUseParallaxMotion) {
        const leavesLayer = parallaxBg.querySelector('.parallax-layer--leaves');
        const signMark = parallaxBg.querySelector('.p-sign');
        const signMarkImg = parallaxBg.querySelector('.p-sign-img');
        let signHasEmerged = false;
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

        // 院内サインの透かし。
        //   現れはじめ … スクロールに合わせて下から静かに浮かび上がる
        //   表示中     … 背景より遅い視差で、紙の上をゆるく漂う
        //   消え際     … 位置を固定し、自然なフェードだけで消える
        // 出はじめる位置は「お知らせ」の下あたり。無いページは画面半分ほど進んだら。
        let signIn = 0, signFull = 0, signHold = 0, signOut = 0;

        function measureSignSchedule() {
            const vh = window.innerHeight;
            const scrollable = Math.max(document.documentElement.scrollHeight - vh, 1);

            const digest = document.querySelector('[data-news-digest]');
            let anchor;
            if (digest) {
                const sec = digest.closest('section') || digest;
                anchor = sec.offsetTop + sec.offsetHeight;   // お知らせの下端
            } else {
                anchor = vh * 1.4;
            }

            // お知らせの下端が画面の下に来たあたりから現れはじめる
            signIn = Math.max(anchor - vh, vh * 0.2);
            signFull = signIn + 350;
            signHold = signIn + 1300;
            signOut = signIn + 1900;

            // 短いページでも、現れて消えるまでがページ内に収まるように縮める
            if (signOut > scrollable) {
                const k = scrollable / signOut;
                signIn *= k; signFull *= k; signHold *= k; signOut *= k;
            }
        }

        function clamp01(value) {
            return Math.max(0, Math.min(value, 1));
        }

        function smoothstep(value) {
            const t = clamp01(value);
            return t * t * (3 - 2 * t);
        }

        // 現在の演出状態。消え際は座標を止め、透明度だけを下げる。
        function signStateAt(y) {
            if (y <= signIn || y >= signOut) {
                return { opacity: 0, lift: 44, scale: 0.955, parallaxY: y };
            }

            if (y < signFull) {
                const entered = smoothstep((y - signIn) / (signFull - signIn));
                return {
                    opacity: entered,
                    lift: (1 - entered) * 44,
                    scale: 0.955 + entered * 0.045,
                    parallaxY: y,
                };
            }

            if (y <= signHold) {
                return { opacity: 1, lift: 0, scale: 1, parallaxY: y };
            }

            const leaving = smoothstep((y - signHold) / (signOut - signHold));
            return { opacity: 1 - leaving, lift: 0, scale: 1, parallaxY: signHold };
        }

        if (signMark) {
            measureSignSchedule();
            // お知らせは後から差し込まれるので、読み込み完了後にもう一度測り直す
            window.addEventListener('load', measureSignSchedule);
            window.addEventListener('resize', measureSignSchedule);
        }

        function render() {
            rafPending = false;
            const y = scrollY;
            const vh = window.innerHeight;
            pointerX += (targetPX - pointerX) * 0.08;
            pointerY += (targetPY - pointerY) * 0.08;

            // 奥ほど遅く、手前ほど速く／マウスにも手前ほど大きく反応させる
            // グリーンの写真はいちばん奥。ほとんど動かず、そっと揺れる程度にする
            const leavesY = -Math.min(y * 0.035, vh * 0.5);
            const leavesX = pointerX * 7;
            const leavesOffsetY = leavesY + pointerY * 7;
            leavesLayer.style.transform =
                'translate3d(' + leavesX.toFixed(1) + 'px, ' + leavesOffsetY.toFixed(1) + 'px, 0)';

            // 院内サイン：入りは浮上、表示中は背景より遅い視差、最後は位置を止めてフェード。
            if (signMark) {
                if (!signHasEmerged && y > signIn) {
                    signHasEmerged = true;
                    signMarkImg.classList.add('is-in');
                }

                const sign = signStateAt(y);
                const signParallaxY =
                    -Math.min(sign.parallaxY * 0.035, vh * 0.5) + pointerY * 7;
                const desiredSignY = signParallaxY * 0.58;
                // 親レイヤーを完全には相殺せず、58%だけ背景の流れに乗せる。
                // 消え際だけは signHold の座標に固定され、移動せずに溶ける。
                signMark.style.transform =
                    'translate3d(' + (-leavesX * 0.42).toFixed(1) + 'px, ' +
                    ((desiredSignY - leavesOffsetY) + sign.lift).toFixed(1) + 'px, 0) scale(' +
                    sign.scale.toFixed(3) + ')';
                signMark.style.opacity = sign.opacity.toFixed(3);
            }

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

    // タッチ端末は、固定背景やぼかしを使わず、葉影と細いリングの2枚だけを動かす。
    // 背景自体は文書と一緒に流し、transform の速度差だけで軽い奥行きをつくる。
    if (canUseMobileParallax) {
        const mobileLeaves = parallaxBg.querySelector('.parallax-layer--leaves');
        const mobileRings = parallaxBg.querySelector('.parallax-layer--rings');
        let mobileScrollY = window.scrollY;
        let mobileRafPending = false;
        let mobileLayersActive = false;
        let mobileReleaseTimer = 0;

        function mobileParallaxLimit() {
            return window.innerHeight * 1.7;
        }

        function setMobileLayersActive(active) {
            if (active === mobileLayersActive) return;
            mobileLayersActive = active;
            parallaxBg.classList.toggle('is-mobile-parallax-active', active);
        }

        function releaseMobileLayersAfterScroll() {
            clearTimeout(mobileReleaseTimer);
            mobileReleaseTimer = setTimeout(function () {
                if (window.scrollY > mobileParallaxLimit()) {
                    setMobileLayersActive(false);
                }
            }, 220);
        }

        function renderMobileParallax() {
            mobileRafPending = false;

            if (document.documentElement.classList.contains('is-page-zoomed')) {
                clearTimeout(mobileReleaseTimer);
                setMobileLayersActive(false);
                return;
            }

            const limit = mobileParallaxLimit();
            if (mobileScrollY > limit) {
                // スクロール中のGPUレイヤー解除は一瞬の引っかかりになるため、停止後に回す。
                releaseMobileLayersAfterScroll();
                return;
            }

            clearTimeout(mobileReleaseTimer);
            setMobileLayersActive(true);
            const y = Math.max(0, mobileScrollY);
            mobileLeaves.style.transform =
                'translate3d(0, ' + (y * 0.28).toFixed(1) + 'px, 0)';
            mobileRings.style.transform =
                'translate3d(0, ' + (y * 0.12).toFixed(1) + 'px, 0)';
        }

        function scheduleMobileParallax() {
            mobileScrollY = window.scrollY;
            if (mobileRafPending) return;
            if (!mobileLayersActive && mobileScrollY > mobileParallaxLimit()) return;
            mobileRafPending = true;
            requestAnimationFrame(renderMobileParallax);
        }

        window.addEventListener('scroll', scheduleMobileParallax, { passive: true });
        window.addEventListener('resize', scheduleMobileParallax, { passive: true });
        renderMobileParallax();
    }

    // --- ヒーロー / ページ見出しの背景写真 ---
    // 開いた時にゆっくり浮かび上がり、スクロールすると奥へ沈みながら消えていく

    // 下層ページには写真レイヤーをJSで差し込む
    const pageHero = document.querySelector('.page-hero');
    if (pageHero) {
        const pageHeroPhoto = document.createElement('div');
        pageHeroPhoto.className = 'page-hero-photo';
        pageHeroPhoto.setAttribute('aria-hidden', 'true');
        pageHeroPhoto.innerHTML = '<div class="page-hero-photo-img"></div>';
        pageHero.prepend(pageHeroPhoto);
    }

    const heroPhoto = document.querySelector('.hero-photo, .page-hero-photo');
    if (heroPhoto) {
        const heroPhotoImg = heroPhoto.querySelector('.hero-photo-img, .page-hero-photo-img');
        const heroSection = heroPhoto.parentElement;

        // 消えきるまでのスクロール量。トップは画面の8割、下層は見出しの高さぶん
        function heroFadeDistance() {
            if (heroSection && heroSection.classList.contains('page-hero')) {
                return Math.max(heroSection.offsetHeight * 1.15, 280);
            }
            return window.innerHeight * 0.8;
        }

        // 浮かび上がり。開幕の幕が出ている時は、幕が消えてから咲くように出す
        function heroPhotoIn() {
            heroPhotoImg.classList.add('is-in');
        }
        if (prefersReducedMotion.matches) {
            // 動きを減らす設定なら、最初から定着させておく
            heroPhotoImg.style.transition = 'none';
            heroPhotoIn();
        } else if (window.hgcCurtainPending) {
            let heroInFired = false;
            const heroInGo = function () {
                if (heroInFired) return;
                heroInFired = true;
                document.removeEventListener('hgc:curtain-end', heroInGo);
                heroPhotoIn();
            };
            document.addEventListener('hgc:curtain-end', heroInGo);
            // 万一、幕の終わりを受け取れなかった時の保険
            setTimeout(heroInGo, 15000);
        } else {
            requestAnimationFrame(heroPhotoIn);
        }

        const canAnimateHeroOnScroll =
            !prefersReducedMotion.matches &&
            (canUseParallaxMotion || canUseMobileParallax);

        if (canAnimateHeroOnScroll) {
            let heroRafPending = false;
            let heroIsHidden = false;
            let heroReleaseTimer = 0;
            const useLightHeroMotion = canUseMobileParallax;

            function heroRender() {
                heroRafPending = false;
                const y = window.scrollY;
                const fadeDistance = heroFadeDistance();

                // 消えた後まで全ページで変形を更新し続けない。
                // 再び上へ戻った時だけレイヤーを復帰させる。
                if (y >= fadeDistance) {
                    if (!heroIsHidden) {
                        heroPhoto.style.opacity = '0';
                        heroPhoto.style.visibility = 'hidden';
                        heroIsHidden = true;
                    }
                    if (useLightHeroMotion) {
                        clearTimeout(heroReleaseTimer);
                        heroReleaseTimer = setTimeout(function () {
                            if (window.scrollY >= heroFadeDistance()) {
                                heroPhoto.classList.remove('is-scroll-active');
                            }
                        }, 220);
                    }
                    return;
                }

                clearTimeout(heroReleaseTimer);
                if (heroIsHidden) {
                    heroPhoto.style.visibility = 'visible';
                    heroIsHidden = false;
                }
                if (useLightHeroMotion) {
                    heroPhoto.classList.add('is-scroll-active');
                }

                const progress = Math.min(y / fadeDistance, 1);
                if (useLightHeroMotion) {
                    // スマホは拡大を加えず、1枚だけをゆっくり遅らせて軽快さを保つ。
                    heroPhoto.style.transform =
                        'translate3d(0, ' + (y * 0.18).toFixed(1) + 'px, 0)';
                } else {
                    // PCはスクロールの4割の速さで遅れて下がる＝奥に沈んで見える。
                    heroPhoto.style.transform =
                        'translateY(' + (y * 0.4).toFixed(1) + 'px) scale(' +
                        (1 + progress * 0.05).toFixed(3) + ')';
                }
                heroPhoto.style.opacity = (1 - progress).toFixed(3);
            }

            window.addEventListener('scroll', function () {
                if (heroRafPending) return;
                heroRafPending = true;
                requestAnimationFrame(heroRender);
            }, { passive: true });

            heroRender();
        }
    }

    // --- モバイルドロワーメニュー ---
    const navToggle = document.querySelector('.nav-toggle');
    const drawer = document.getElementById('site-drawer');

    if (navToggle && drawer) {
        function openDrawer() {
            navToggle.setAttribute('aria-expanded', 'true');
            drawer.setAttribute('aria-hidden', 'false');
            drawer.classList.add('is-open');
            document.documentElement.classList.add('drawer-open');
            document.body.classList.add('drawer-open');
        }

        function closeDrawer() {
            navToggle.setAttribute('aria-expanded', 'false');
            drawer.setAttribute('aria-hidden', 'true');
            drawer.classList.remove('is-open');
            document.documentElement.classList.remove('drawer-open');
            document.body.classList.remove('drawer-open');
        }

        drawer.setAttribute('aria-hidden', 'true');

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

    // --- 駐車場案内画像の拡大表示 ---
    const imageZoomTriggers = document.querySelectorAll('.parking-zoom-trigger');
    if (imageZoomTriggers.length > 0) {
        const imageLightbox = document.createElement('div');
        imageLightbox.className = 'image-lightbox';
        imageLightbox.hidden = true;
        imageLightbox.setAttribute('role', 'dialog');
        imageLightbox.setAttribute('aria-modal', 'true');
        imageLightbox.setAttribute('aria-labelledby', 'image-lightbox-title');
        imageLightbox.setAttribute('aria-describedby', 'image-lightbox-help');
        imageLightbox.innerHTML =
            '<div class="image-lightbox-panel">' +
                '<div class="image-lightbox-toolbar">' +
                    '<p class="image-lightbox-title" id="image-lightbox-title"></p>' +
                    '<button class="image-lightbox-close" type="button">' +
                        '<span class="image-lightbox-close-mark" aria-hidden="true">×</span>閉じる' +
                    '</button>' +
                '</div>' +
                '<div class="image-lightbox-viewport">' +
                    '<button class="image-lightbox-canvas" type="button" aria-label="画像をさらに拡大する">' +
                        '<img class="image-lightbox-image" alt="">' +
                    '</button>' +
                '</div>' +
                '<p class="image-lightbox-help" id="image-lightbox-help">画像をタップするとさらに拡大できます。拡大後は指で上下左右に動かせます。</p>' +
            '</div>';
        document.body.appendChild(imageLightbox);

        const lightboxTitle = imageLightbox.querySelector('.image-lightbox-title');
        const lightboxClose = imageLightbox.querySelector('.image-lightbox-close');
        const lightboxViewport = imageLightbox.querySelector('.image-lightbox-viewport');
        const lightboxCanvas = imageLightbox.querySelector('.image-lightbox-canvas');
        const lightboxImage = imageLightbox.querySelector('.image-lightbox-image');
        const lightboxHelp = imageLightbox.querySelector('.image-lightbox-help');
        let activeZoomTrigger = null;
        let closeTimer = null;

        function resetLightboxZoom() {
            lightboxCanvas.classList.remove('is-zoomed');
            lightboxCanvas.setAttribute('aria-label', '画像をさらに拡大する');
            lightboxHelp.textContent = '画像をタップするとさらに拡大できます。拡大後は指で上下左右に動かせます。';
            lightboxViewport.scrollTop = 0;
            lightboxViewport.scrollLeft = 0;
        }

        function openImageLightbox(trigger) {
            const image = trigger.querySelector('img');
            const figure = trigger.closest('figure');
            const caption = figure && figure.querySelector('figcaption');
            if (!image) return;

            clearTimeout(closeTimer);
            activeZoomTrigger = trigger;
            resetLightboxZoom();
            lightboxImage.src = image.currentSrc || image.src;
            lightboxImage.alt = image.alt || '';
            lightboxTitle.textContent = caption ? caption.textContent.trim() : '画像の拡大表示';
            imageLightbox.hidden = false;
            document.documentElement.classList.add('is-lightbox-open');
            requestAnimationFrame(function () {
                imageLightbox.classList.add('is-open');
                lightboxClose.focus();
            });
        }

        function closeImageLightbox() {
            if (imageLightbox.hidden) return;
            imageLightbox.classList.remove('is-open');
            document.documentElement.classList.remove('is-lightbox-open');
            closeTimer = setTimeout(function () {
                imageLightbox.hidden = true;
                lightboxImage.removeAttribute('src');
                resetLightboxZoom();
                if (activeZoomTrigger) activeZoomTrigger.focus();
                activeZoomTrigger = null;
            }, 280);
        }

        imageZoomTriggers.forEach(function (trigger) {
            trigger.addEventListener('click', function () {
                openImageLightbox(trigger);
            });
        });

        lightboxClose.addEventListener('click', closeImageLightbox);

        lightboxCanvas.addEventListener('click', function (e) {
            // 画像の外側をタップした時は閉じる。キーボード操作時は拡大操作として扱う。
            if (e.target === lightboxCanvas && e.detail !== 0) {
                closeImageLightbox();
                return;
            }
            const isZoomed = lightboxCanvas.classList.toggle('is-zoomed');
            lightboxCanvas.setAttribute('aria-label', isZoomed ? '画像を全体表示に戻す' : '画像をさらに拡大する');
            lightboxHelp.textContent = isZoomed
                ? '拡大表示中です。指で上下左右に動かせます。画像をタップすると全体表示に戻ります。'
                : '画像をタップするとさらに拡大できます。拡大後は指で上下左右に動かせます。';

            requestAnimationFrame(function () {
                if (isZoomed) {
                    lightboxViewport.scrollLeft =
                        Math.max((lightboxViewport.scrollWidth - lightboxViewport.clientWidth) / 2, 0);
                    lightboxViewport.scrollTop =
                        Math.max((lightboxViewport.scrollHeight - lightboxViewport.clientHeight) / 2, 0);
                } else {
                    lightboxViewport.scrollTop = 0;
                    lightboxViewport.scrollLeft = 0;
                }
            });
        });

        imageLightbox.addEventListener('click', function (e) {
            if (e.target === imageLightbox) closeImageLightbox();
        });

        document.addEventListener('keydown', function (e) {
            if (imageLightbox.hidden) return;
            if (e.key === 'Escape') {
                closeImageLightbox();
                return;
            }
            if (e.key !== 'Tab') return;

            const focusable = [lightboxClose, lightboxCanvas];
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    }

    // --- ヘッダーのスクロール状態 ---
    const header = document.querySelector('.site-header');
    if (header) {
        let headerTicking = false;
        let headerScrolled = null;

        function updateHeader() {
            headerTicking = false;
            const nextScrolled = window.scrollY > 20;
            if (nextScrolled === headerScrolled) return;
            headerScrolled = nextScrolled;
            header.classList.toggle('is-scrolled', nextScrolled);
        }

        function scheduleHeaderUpdate() {
            if (headerTicking) return;
            headerTicking = true;
            requestAnimationFrame(updateHeader);
        }

        window.addEventListener('scroll', scheduleHeaderUpdate, { passive: true });
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
                const isHeroTitle = heading.classList.contains('hero-title');
                const isPageTitle = heading.classList.contains('page-hero-title');
                const baseDelay = isHeroTitle ? 0.28 : (isPageTitle ? 0.18 : 0.08);
                const stepDelay = isHeroTitle ? 0.085 : (isPageTitle ? 0.075 : 0.065);

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
                            inner.style.transitionDelay = (baseDelay + index * stepDelay).toFixed(3) + 's';
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

    // --- アニメーション開始の同期 ---
    // 初回の幕やページ遷移が消える前に演出が終わらないよう、
    // 実際に本文が見えるタイミングでまとめて開始する。
    const motionRoot = document.documentElement;
    let motionReadyTimer = null;

    function makeMotionReady() {
        if (motionRoot.classList.contains('motion-ready')) return;
        clearTimeout(motionReadyTimer);
        requestAnimationFrame(function () {
            motionRoot.classList.add('motion-ready');
        });
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        makeMotionReady();
    } else if (window.hgcCurtainPending) {
        document.addEventListener('hgc:curtain-end', makeMotionReady, { once: true });
        motionReadyTimer = setTimeout(makeMotionReady, 8000);
    } else if (window.hgcPageEntering || motionRoot.classList.contains('is-entering')) {
        document.addEventListener('hgc:page-entered', makeMotionReady, { once: true });
        motionReadyTimer = setTimeout(makeMotionReady, 1200);
    } else {
        motionReadyTimer = setTimeout(makeMotionReady, 260);
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
    const revealTargets = document.querySelectorAll('[data-reveal], [data-motion], .split-text');
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
            { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
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
