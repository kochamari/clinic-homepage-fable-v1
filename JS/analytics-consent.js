'use strict';

(() => {
    const measurementId = window.HGC_SITE_CONFIG?.gaMeasurementId?.trim() || '';
    if (!/^G-[A-Z0-9]+$/i.test(measurementId)) return;

    const storageKey = 'hgc-analytics-consent';
    const analyticsScriptId = 'hgc-google-analytics';
    const disableKey = `ga-disable-${measurementId}`;
    let banner = null;
    let analyticsStarted = false;

    function readConsent() {
        try {
            const value = window.localStorage.getItem(storageKey);
            return value === 'granted' || value === 'denied' ? value : null;
        } catch {
            return null;
        }
    }

    function saveConsent(value) {
        try {
            window.localStorage.setItem(storageKey, value);
        } catch {
            // Storage may be unavailable in private browsing or restricted environments.
        }
    }

    function analyticsCookieNames() {
        return document.cookie
            .split(';')
            .map((cookie) => cookie.split('=')[0].trim())
            .filter((name) => name === '_ga' || name.startsWith('_ga_'));
    }

    function cookieDomains() {
        const hostname = window.location.hostname;
        if (!hostname || hostname === 'localhost' || /^\d+(?:\.\d+){3}$/.test(hostname)) {
            return [];
        }

        const labels = hostname.split('.');
        const domains = new Set([hostname, `.${hostname}`]);
        if (labels.length > 2) {
            const registrableDomain = labels.slice(-2).join('.');
            domains.add(registrableDomain);
            domains.add(`.${registrableDomain}`);
        }
        return [...domains];
    }

    function removeAnalyticsCookies() {
        for (const name of analyticsCookieNames()) {
            document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
            for (const domain of cookieDomains()) {
                document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}; SameSite=Lax`;
            }
        }
    }

    function updateGoogleConsent(value) {
        if (typeof window.gtag !== 'function') return;
        window.gtag('consent', 'update', {
            analytics_storage: value,
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
        });
    }

    function startAnalytics() {
        if (analyticsStarted || document.getElementById(analyticsScriptId)) return;
        analyticsStarted = true;
        window[disableKey] = false;
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function gtag() {
            window.dataLayer.push(arguments);
        };

        window.gtag('consent', 'default', {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
        });
        window.gtag('js', new Date());
        window.gtag('config', measurementId, {
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            page_location: `${window.location.origin}${window.location.pathname}`,
        });

        const script = document.createElement('script');
        script.id = analyticsScriptId;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        document.head.appendChild(script);
    }

    function hideBanner() {
        if (!banner) return;
        banner.hidden = true;
    }

    function setConsent(value) {
        saveConsent(value);
        if (value === 'granted') {
            startAnalytics();
        } else {
            window[disableKey] = true;
            updateGoogleConsent('denied');
            removeAnalyticsCookies();
        }
        hideBanner();
    }

    function createBanner() {
        const region = document.createElement('section');
        region.className = 'analytics-consent';
        region.setAttribute('role', 'region');
        region.setAttribute('aria-labelledby', 'analytics-consent-title');
        region.hidden = true;
        region.innerHTML = `
            <p class="analytics-consent-text" id="analytics-consent-title">当サイトでは、利用状況の把握と改善のためアクセス解析を使用します。</p>
            <div class="analytics-consent-actions">
                <button class="analytics-consent-button" type="button" data-consent="granted">同意する</button>
                <button class="analytics-consent-button" type="button" data-consent="denied">拒否する</button>
                <a class="analytics-consent-details" href="privacy.html#analytics">詳しく見る</a>
            </div>
        `;

        region.addEventListener('click', (event) => {
            const button = event.target.closest('[data-consent]');
            if (button) setConsent(button.dataset.consent);
        });
        document.body.appendChild(region);
        return region;
    }

    function showBanner({ focus = false } = {}) {
        if (!banner) banner = createBanner();
        banner.hidden = false;
        if (focus) banner.querySelector('[data-consent="granted"]')?.focus();
    }

    function initialize() {
        const settingsButtons = document.querySelectorAll('.footer-cookie-settings');
        for (const button of settingsButtons) {
            button.hidden = false;
            button.addEventListener('click', () => showBanner({ focus: true }));
        }

        const savedConsent = readConsent();
        if (savedConsent === 'granted') {
            startAnalytics();
        } else if (savedConsent === 'denied') {
            window[disableKey] = true;
        } else {
            showBanner();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
