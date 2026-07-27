'use strict';

(() => {
    const measurementId = window.HGC_SITE_CONFIG?.gaMeasurementId?.trim() || '';
    if (!/^G-[A-Z0-9]+$/i.test(measurementId)) return;

    const analyticsScriptId = 'hgc-google-analytics';
    if (document.getElementById(analyticsScriptId)) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
        window.dataLayer.push(arguments);
    };

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
})();
