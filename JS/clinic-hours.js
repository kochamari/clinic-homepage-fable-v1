// 診療時間・休診日の設定と、「今の診療状況」「休診日カレンダー」の表示
//
// ============================================================
// ■ 臨時休診（お盆・年末年始・学会など）は JS/news-data.js の
//   各お知らせに closures を追加すると、カレンダーにも自動反映されます。
//
// ■ 祝日は JS/holidays-data.js に記録しています。
//   このファイルは内閣府CSVから自動生成され、GitHub Actionsが毎月更新を確認します。
//
// ■ 時刻基準
//   診療状況と休診日カレンダーは、閲覧者の端末ではなく
//   Asia/Tokyo（日本時間）を基準に判定します。
// ============================================================

const TOKYO_TIME_ZONE = 'Asia/Tokyo';
const tokyoDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TOKYO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
});

function nowInTokyo() {
    const parts = tokyoDateTimeFormatter.formatToParts(new Date());
    const values = {};
    parts.forEach(function (part) {
        if (part.type !== 'literal') values[part.type] = Number(part.value);
    });
    // 東京の年月日時分をUTC上の同じ数値として保持し、以降の計算を端末TZから分離する。
    return new Date(Date.UTC(
        values.year,
        values.month - 1,
        values.day,
        values.hour,
        values.minute
    ));
}

const clinicSchedule = {
    // 曜日ごとの受付時間（0=日曜, 1=月曜 … 6=土曜）。[] は休診
    weekly: {
        0: [],                                        // 日曜：休診
        1: [['09:00', '12:30'], ['14:00', '17:30']],  // 月曜
        2: [['09:00', '12:30'], ['14:00', '17:30']],  // 火曜
        3: [['09:00', '12:00']],                      // 水曜：午前のみ（12:00まで）
        4: [['09:00', '12:30'], ['14:00', '17:30']],  // 木曜
        5: [['09:00', '12:30'], ['14:00', '17:30']],  // 金曜
        6: [['09:00', '12:30']]                       // 土曜：午前のみ
    }
};

(function () {
    'use strict';

    const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
    const holidaySet = new Set(
        typeof nationalHolidays === 'undefined' ? [] : nationalHolidays
    );

    function closureMapFromNews() {
        const closures = new Map();
        if (typeof newsData === 'undefined' || !Array.isArray(newsData.news)) return closures;

        newsData.news.forEach(function (item) {
            if (!item || !Array.isArray(item.closures)) return;
            item.closures.forEach(function (closure) {
                if (!closure || !/^\d{4}-\d{2}-\d{2}$/.test(closure.date)) return;
                if (!closures.has(closure.date)) {
                    closures.set(closure.date, String(closure.label || item.title || '臨時休診'));
                }
            });
        });
        return closures;
    }

    const closureMap = closureMapFromNews();

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function ymd(date) {
        return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate());
    }

    function toMinutes(hhmm) {
        const parts = hhmm.split(':');
        return Number(parts[0]) * 60 + Number(parts[1]);
    }

    function isFourthSaturday(date) {
        const day = date.getUTCDate();
        return date.getUTCDay() === 6 && day >= 22 && day <= 28;
    }

    // その日の受付時間帯を返す（休診日は空配列）
    function sessionsOf(date) {
        const key = ymd(date);
        if (closureMap.has(key) || holidaySet.has(key)) return [];
        return clinicSchedule.weekly[date.getUTCDay()] || [];
    }

    // 休診の理由（臨時休診名・祝日・通常の休診日）
    function closureReason(date) {
        const key = ymd(date);
        if (closureMap.has(key)) return closureMap.get(key);
        if (holidaySet.has(key)) return '祝日';
        return '休診';
    }

    // 次に受付を開始する日時を探す
    function nextOpening(from) {
        const cursor = new Date(from);
        for (let i = 0; i < 60; i++) {
            const sessions = sessionsOf(cursor);
            const limit = (i === 0) ? from.getUTCHours() * 60 + from.getUTCMinutes() : -1;
            for (let s = 0; s < sessions.length; s++) {
                if (toMinutes(sessions[s][0]) > limit) {
                    return { date: new Date(cursor), start: sessions[s][0] };
                }
            }
            cursor.setUTCDate(cursor.getUTCDate() + 1);
            cursor.setUTCHours(0, 0, 0, 0);
        }
        return null;
    }

    function nextOpeningText(now) {
        const next = nextOpening(now);
        if (!next) return '';
        const today = new Date(now);
        today.setUTCHours(0, 0, 0, 0);
        const target = new Date(next.date);
        target.setUTCHours(0, 0, 0, 0);
        const diff = Math.round((target - today) / 86400000);
        let day;
        if (diff === 0) day = '本日';
        else if (diff === 1) day = '明日';
        else day = (target.getUTCMonth() + 1) + '月' + target.getUTCDate() + '日(' + WEEK[target.getUTCDay()] + ')';
        return '次の受付は' + day + ' ' + next.start + 'から';
    }

    // 現在の診療状況を判定する
    function getStatus(now) {
        const sessions = sessionsOf(now);
        const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

        if (!sessions.length) {
            const reason = closureReason(now);
            return {
                state: 'closed',
                label: reason === '休診' ? '本日休診' : '本日休診（' + reason + '）',
                detail: nextOpeningText(now)
            };
        }

        for (let i = 0; i < sessions.length; i++) {
            const start = toMinutes(sessions[i][0]);
            const end = toMinutes(sessions[i][1]);
            if (nowMin < start) {
                return i === 0
                    ? { state: 'before', label: '開院前', detail: sessions[i][0] + 'から受付開始' }
                    : { state: 'lunch', label: '休憩中', detail: sessions[i][0] + 'から受付再開' };
            }
            if (nowMin < end) {
                return { state: 'open', label: '診療中', detail: sessions[i][1] + 'まで受付' };
            }
        }

        return { state: 'after', label: '本日の受付終了', detail: nextOpeningText(now) };
    }

    // 「今の診療状況」を描画する
    function renderStatus() {
        const nodes = document.querySelectorAll('[data-clinic-status]');
        if (!nodes.length) return;
        const status = getStatus(nowInTokyo());
        nodes.forEach(function (node) {
            node.className = 'clinic-status is-' + status.state;
            node.innerHTML =
                '<span class="clinic-status-dot"></span>' +
                '<span class="clinic-status-label">' + status.label + '</span>' +
                (status.detail ? '<span class="clinic-status-detail">' + status.detail + '</span>' : '');
        });
    }

    // 1か月分のカレンダーHTMLをつくる
    function monthHTML(year, month, todayKey) {
        const first = new Date(Date.UTC(year, month, 1));
        const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        let cells = '';

        for (let i = 0; i < first.getUTCDay(); i++) {
            cells += '<span class="cal-cell is-empty" aria-hidden="true"></span>';
        }

        for (let day = 1; day <= days; day++) {
            const date = new Date(Date.UTC(year, month, day));
            const sessions = sessionsOf(date);
            const classes = ['cal-cell'];
            let label = '';

            if (!sessions.length) {
                classes.push('is-closed');
                label = closureReason(date);
            } else if (sessions.length === 1) {
                classes.push('is-half');
                label = '午前のみ';
            }
            if (sessions.length && isFourthSaturday(date)) {
                classes.push('is-oda');
                label += (label ? '・' : '') + '小田先生診察';
            }
            if (ymd(date) === todayKey) classes.push('is-today');

            cells += '<span class="' + classes.join(' ') + '">' + day +
                (classes.includes('is-oda')
                    ? '<span class="cal-doctor-badge" aria-hidden="true">小田</span>'
                    : '') +
                (label ? '<span class="visually-hidden">（' + label + '）</span>' : '') +
                '</span>';
        }

        const heads = WEEK.map(function (w, i) {
            const cls = i === 0 ? ' is-sun' : (i === 6 ? ' is-sat' : '');
            return '<span class="cal-head' + cls + '">' + w + '</span>';
        }).join('');

        return '<div class="cal-month">' +
            '<p class="cal-title">' + year + '年' + (month + 1) + '月</p>' +
            '<div class="cal-grid">' + heads + cells + '</div>' +
            '</div>';
    }

    // 休診日カレンダー（今月・来月）を描画する
    function renderCalendar() {
        const host = document.querySelector('[data-closure-calendar]');
        if (!host) return;

        const now = nowInTokyo();
        const todayKey = ymd(now);
        let html = '';
        const notes = [];

        for (let offset = 0; offset < 2; offset++) {
            const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
            html += monthHTML(base.getUTCFullYear(), base.getUTCMonth(), todayKey);

            // 表示中の月にある、お知らせ由来の臨時休診をまとめる
            closureMap.forEach(function (label, date) {
                const parts = date.split('-').map(Number);
                if (parts[0] === base.getUTCFullYear() && parts[1] - 1 === base.getUTCMonth()) {
                    notes.push({ month: parts[1], day: parts[2], label: label });
                }
            });
        }

        host.innerHTML = html;

        // 臨時休診を「8月13日〜15日 お盆休み」のようにまとめて表示
        const noteHost = document.querySelector('[data-closure-notes]');
        if (noteHost) {
            if (!notes.length) {
                noteHost.innerHTML = '';
                return;
            }
            const grouped = [];
            notes.forEach(function (n) {
                const last = grouped[grouped.length - 1];
                if (last && last.label === n.label && last.month === n.month && n.day === last.end + 1) {
                    last.end = n.day;
                } else {
                    grouped.push({ month: n.month, start: n.day, end: n.day, label: n.label });
                }
            });
            noteHost.innerHTML = grouped.map(function (g) {
                const range = g.start === g.end
                    ? g.month + '月' + g.start + '日'
                    : g.month + '月' + g.start + '日〜' + g.end + '日';
                return '<li><span class="closure-note-date">' + range + '</span>' + g.label + '</li>';
            }).join('');
        }
    }

    // 診療時間表で「今日」の曜日の列を目立たせる
    function highlightToday() {
        const table = document.querySelector('[data-hours-table]');
        if (!table) return;

        const now = nowInTokyo();
        // 表の列は 0=見出し, 1=月 … 6=土, 7=日祝
        const col = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
        const isClosed = sessionsOf(now).length === 0;

        table.querySelectorAll('tr').forEach(function (row) {
            const cell = row.children[col];
            if (!cell) return;
            cell.classList.add('is-today-col');
            if (isClosed) cell.classList.add('is-closed-today');
        });

        const headRow = table.querySelector('thead tr');
        if (headRow && headRow.children[col]) {
            const badge = document.createElement('span');
            badge.className = 'today-badge' + (isClosed ? ' is-closed' : '');
            badge.textContent = '今日';
            headRow.children[col].appendChild(badge);
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        renderStatus();
        renderCalendar();
        highlightToday();
        // 時間の経過で表示が古くならないよう、1分ごとに更新する
        setInterval(renderStatus, 60000);
    });
})();
