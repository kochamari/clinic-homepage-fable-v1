// 原口消化器内科 — サイト共通スクリプト
// 1. パララックス背景
// 2. モバイルドロワーメニュー
// 3. ヘッダーのスクロール状態
// 4. スクロール連動の表示アニメーション（IntersectionObserver）

document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', function () {
    // --- パララックス背景 ---
    // 3層の背景を body の先頭に挿入し、スクロール量に応じて
    // 遠景（far）と近景（near）を別々の速度で動かして奥行きを出す
    const parallaxBg = document.createElement('div');
    parallaxBg.className = 'parallax-bg';
    parallaxBg.setAttribute('aria-hidden', 'true');
    parallaxBg.innerHTML =
        '<div class="parallax-layer parallax-layer--far"></div>' +
        '<div class="parallax-layer parallax-layer--near"></div>' +
        '<div class="parallax-layer parallax-layer--drift"></div>';
    document.body.prepend(parallaxBg);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!prefersReducedMotion.matches) {
        const farLayer = parallaxBg.querySelector('.parallax-layer--far');
        const nearLayer = parallaxBg.querySelector('.parallax-layer--near');
        let parallaxTicking = false;

        function updateParallax() {
            const y = window.scrollY;
            // far はレイヤーの下側の余白（55vh）を超えないよう控えめに動かす
            const farShift = Math.min(y * 0.06, window.innerHeight * 0.5);
            // near はドットの繰り返し周期（26px）でループさせて、どこまでも滑らかに流す
            const nearShift = (y * 0.16) % 26;
            farLayer.style.transform = 'translate3d(0, ' + (-farShift).toFixed(1) + 'px, 0)';
            nearLayer.style.transform = 'translate3d(0, ' + (-nearShift).toFixed(1) + 'px, 0)';
            parallaxTicking = false;
        }

        window.addEventListener('scroll', function () {
            if (!parallaxTicking) {
                requestAnimationFrame(updateParallax);
                parallaxTicking = true;
            }
        }, { passive: true });
        updateParallax();
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

    // --- スクロール連動アニメーション ---
    const revealTargets = document.querySelectorAll('[data-reveal]');
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
