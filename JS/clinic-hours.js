// 診療時間・休診日の設定と、「今の診療状況」「休診日カレンダー」の表示
//
// ============================================================
// ■ 臨時休診（お盆・年末年始・学会など）を追加するには
//   下の closures に1行足してください。日付は "西暦-月-日" の形式です。
//     { "date": "2026-08-13", "label": "お盆休み" },
//
// ■ 祝日は holidays に列挙しています。
//   年が変わったら、その年の祝日を追加してください。
//   （祝日は自動では増えません。追加を忘れると通常営業として表示されます）
// ============================================================

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
    },

    // 臨時休診
    closures: [
        { date: '2026-08-13', label: 'お盆休み' },
        { date: '2026-08-14', label: 'お盆休み' },
        { date: '2026-08-15', label: 'お盆休み' }
    ],

    // 祝日（休診）
    holidays: [
        // 2026年
        '2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20',
        '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06',
        '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23',
        '2026-10-12', '2026-11-03', '2026-11-23',
        // 2027年（春分・秋分の日は前年2月の官報で確定します）
        '2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-21',
        '2027-03-22', '2027-04-29', '2027-05-03', '2027-05-04', '2027-05-05',
        '2027-07-19', '2027-08-11', '2027-09-20', '2027-09-23', '2027-10-11',
        '2027-11-03', '2027-11-23'
    ]
};

(function () {
    'use strict';

    const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
    const holidaySet = new Set(clinicSchedule.holidays);
    const closureMap = new Map(clinicSchedule.closures.map(c => [c.date, c.label]));

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function ymd(date) {
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    function toMinutes(hhmm) {
        const parts = hhmm.split(':');
        return Number(parts[0]) * 60 + Number(parts[1]);
    }

    // その日の受付時間帯を返す（休診日は空配列）
    function sessionsOf(date) {
        const key = ymd(date);
        if (closureMap.has(key) || holidaySet.has(key)) return [];
        return clinicSchedule.weekly[date.getDay()] || [];
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
            const limit = (i === 0) ? from.getHours() * 60 + from.getMinutes() : -1;
            for (let s = 0; s < sessions.length; s++) {
                if (toMinutes(sessions[s][0]) > limit) {
                    return { date: new Date(cursor), start: sessions[s][0] };
                }
            }
            cursor.setDate(cursor.getDate() + 1);
            cursor.setHours(0, 0, 0, 0);
        }
        return null;
    }

    function nextOpeningText(now) {
        const next = nextOpening(now);
        if (!next) return '';
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const target = new Date(next.date);
        target.setHours(0, 0, 0, 0);
        const diff = Math.round((target - today) / 86400000);
        let day;
        if (diff === 0) day = '本日';
        else if (diff === 1) day = '明日';
        else day = (target.getMonth() + 1) + '月' + target.getDate() + '日(' + WEEK[target.getDay()] + ')';
        return '次の受付は' + day + ' ' + next.start + 'から';
    }

    // 現在の診療状況を判定する
    function getStatus(now) {
        const sessions = sessionsOf(now);
        const nowMin = now.getHours() * 60 + now.getMinutes();

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
        const status = getStatus(new Date());
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
        const first = new Date(year, month, 1);
        const days = new Date(year, month + 1, 0).getDate();
        let cells = '';

        for (let i = 0; i < first.getDay(); i++) {
            cells += '<span class="cal-cell is-empty" aria-hidden="true"></span>';
        }

        for (let day = 1; day <= days; day++) {
            const date = new Date(year, month, day);
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
            if (ymd(date) === todayKey) classes.push('is-today');

            cells += '<span class="' + classes.join(' ') + '">' + day +
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

        const now = new Date();
        const todayKey = ymd(now);
        let html = '';
        const notes = [];

        for (let offset = 0; offset < 2; offset++) {
            const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
            html += monthHTML(base.getFullYear(), base.getMonth(), todayKey);

            // 表示中の月にある臨時休診をまとめる
            clinicSchedule.closures.forEach(function (c) {
                const parts = c.date.split('-').map(Number);
                if (parts[0] === base.getFullYear() && parts[1] - 1 === base.getMonth()) {
                    notes.push({ month: parts[1], day: parts[2], label: c.label });
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

        const now = new Date();
        // 表の列は 0=見出し, 1=月 … 6=土, 7=日祝
        const col = now.getDay() === 0 ? 7 : now.getDay();
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
