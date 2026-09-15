// 日付だけの値と、お知らせの掲載期間を日本時間で扱う共通処理。
(function () {
    'use strict';
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
    });

    function validDate(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [year, month, day] = value.split('-').map(Number);
        if (year < 1000) return false;
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    }

    function today(now = new Date()) {
        const parts = {};
        formatter.formatToParts(now).forEach(part => { parts[part.type] = part.value; });
        return `${parts.year}-${parts.month}-${parts.day}`;
    }

    function formatDate(value) {
        return validDate(value) ? value.replace(/-/g, '.') : '';
    }

    function visible(item, day = today()) {
        if (!item || !validDate(item.date) || !validDate(day)) return false;
        const { displayFrom: from, displayUntil: until } = item;
        if (from !== undefined && !validDate(from)) return false;
        if (until !== undefined && !validDate(until)) return false;
        if (from !== undefined && until !== undefined && from > until) return false;
        return (from === undefined || from <= day) && (until === undefined || day <= until);
    }

    function popupVisible(item, day = today()) {
        if (!visible(item, day) || item.popup !== true) return false;
        if (item.popupUntil === undefined) return true;
        if (!validDate(item.popupUntil)) return false;
        if (item.displayFrom !== undefined && item.displayFrom > item.popupUntil) return false;
        return day <= item.popupUntil;
    }

    // 深夜・タブ復帰・戻る操作で再確認する。呼び出し側は変化のないDOMを保つ。
    function watchDay(refresh) {
        let timer;
        function update() {
            clearTimeout(timer);
            refresh();
            const dayMilliseconds = 86400000;
            const elapsed = (Date.now() + 9 * 3600000) % dayMilliseconds;
            timer = setTimeout(update, dayMilliseconds - elapsed);
        }
        document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
        window.addEventListener('pageshow', update);
        update();
    }

    window.HGCDate = Object.freeze({ validDate, today, formatDate, visible, popupVisible, watchDay });
})();
