/**********************************************************************
 * 0) FAVICON (💜 маркер автоответа) + восстановление
 **********************************************************************/
(function () {
    // Ставим “сердечко”, чтобы было видно, что есть авто-помеченные треды
    window.setFaviconHeart = function setFaviconHeart() {
        document
            .querySelectorAll("link[rel='icon'], link[rel='shortcut icon']")
            .forEach((e) => e.remove());

        const l = document.createElement("link");
        l.rel = "icon";
        l.href =
            "data:image/x-icon;base64,AAABAAEAEBAQAAEABAAoAQAAFgAAACgAAAAQAAAAIAAAAAEABAAAAAAAgAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAA/wCuAG5DYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAhIAAAAAAAAhESAAAAAAAhEREgAAAAAhERERIAAAAhERERESAAAhEREREREgAhERERERERICEREREREREgIRERERERESAhEREiERERICEREgAhERIAAhEgAAIRIAAAIgAAACIAAAAAAAAAAAAAAAAAAAAAAAD+/wAA/H8AAPg/AADwHwAA4A8AAMAHAACAAwAAAAEAAAABAAAAAQAAAAEAAAMDAACHhwAAz88AAP//AAD//wAA";
        document.head.appendChild(l);

        console.log("[AutoFH] favicon: 💜");
    };

    // Возврат стандартной иконки Freelancehunt
    window.restoreFavicon = function restoreFavicon() {
        document
            .querySelectorAll("link[rel='icon'], link[rel='shortcut icon']")
            .forEach((e) => e.remove());

        const l = document.createElement("link");
        l.rel = "icon";
        l.href = "/favicon.ico";
        document.head.appendChild(l);

        console.log("[AutoFH] favicon restored");
    };
})();

/**********************************************************************
 * ГЛОБАЛЬНЫЕ КОНСТАНТЫ ДЛЯ localStorage
 **********************************************************************/
const FH_LS_MARK_KEY = "fh-auto-marks";              // список тредов с автоответом
const FH_LS_JUMP_BLOCK_UNTIL = "fh-jump-block-until"; // блок авто-прыжков после автоответа

function fhGetAutoMode() {
    return localStorage.getItem("fh-auto-mode") === "on";
}

/**********************************************************************
 * 1) КНОПКА AUTO: ON / OFF
 **********************************************************************/
(function () {
    const KEY = "fh-auto-mode";
    let mode = localStorage.getItem(KEY) || "on";

    const btn = document.createElement("div");
    btn.id = "fh-auto-toggle-btn";
    btn.textContent = mode === "on" ? "AUTO: ON" : "AUTO: OFF";
    btn.style.cssText = `
        position:fixed; bottom:15px; right:15px; z-index:999999;
        padding:8px 14px; border-radius:8px;
        font-family:Arial; font-size:14px; cursor:pointer;
        color:#fff; box-shadow:0 0 10px rgba(0,0,0,0.35);
        background:${mode === "on" ? "#28a745" : "#dc3545"};
        opacity:0.85; transition:0.2s;
    `;
    btn.onmouseenter = () => (btn.style.opacity = "1");
    btn.onmouseleave = () => (btn.style.opacity = "0.85");

    btn.onclick = () => {
        mode = mode === "on" ? "off" : "on";
        localStorage.setItem(KEY, mode);
        btn.textContent = mode === "on" ? "AUTO: ON" : "AUTO: OFF";
        btn.style.background = mode === "on" ? "#28a745" : "#dc3545";
        console.log("[AutoFH] режим переключён →", mode);
    };

    document.body.appendChild(btn);
})();

/**********************************************************************
 * 2) MAILBOX — AutoJump v10
 *    Отслеживает badge, делает reload, потом открывает thread-unread
 *    Учитывает блокировку после автоответа
 **********************************************************************/
(function () {
    if (
        !location.pathname.startsWith("/mailbox") ||
        location.pathname.includes("/read/")
    )
        return;

    console.log("[AutoJump v10] работа на /mailbox");

    const badge = document.querySelector("span[data-unread-message-count]");
    if (!badge) {
        console.log("[AutoJump] badge не найден");
        return;
    }

    let lastVal = parseInt(badge.textContent.trim() || "0", 10) || 0;

    function isJumpBlocked() {
        const until = parseInt(
            localStorage.getItem(FH_LS_JUMP_BLOCK_UNTIL) || "0",
            10
        );
        if (!until) return false;
        return Date.now() < until;
    }

    function openUnread() {
        const link = document.querySelector(
            "tr.thread-unread a[href*='/mailbox/read/thread']"
        );
        if (link) {
            console.log("[AutoJump] unread найден → открываю");
            link.click();
            return true;
        }
        return false;
    }

    function tryOpenUnreadAfterLoad() {
        if (!fhGetAutoMode()) return;
        if (isJumpBlocked()) {
            console.log("[AutoJump] сейчас авто-переход блокирован (после автоответа)");
            return;
        }
        setTimeout(() => {
            openUnread();
        }, 250);
    }

    const obs = new MutationObserver(() => {
        const curVal = parseInt(badge.textContent.trim() || "0", 10) || 0;
        console.log(`[AutoJump] badge: ${lastVal} → ${curVal}`);

        if (!fhGetAutoMode()) {
            lastVal = curVal;
            return;
        }

        if (curVal > lastVal) {
            // Пришло новое сообщение
            if (isJumpBlocked()) {
                console.log(
                    "[AutoJump] новое сообщение, но jump заблокирован (после автоответа)"
                );
            } else {
                console.log("[AutoJump] новое сообщение → reload");
                setTimeout(() => {
                    window.location.replace(window.location.href);
                }, 80);
            }
        }

        lastVal = curVal;
    });

    obs.observe(badge, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    window.addEventListener("load", tryOpenUnreadAfterLoad);
})();

/**********************************************************************
 * 3) THREAD PAGE — AutoReply v10 + возврат на mailbox + авто-метки
 **********************************************************************/
(function () {
    if (!location.pathname.includes("/mailbox/read/thread")) return;

    console.log("[AutoReply v10] работа на треде");

    const MY_ID = "1826843"; // твой profile-id
    const EXCLUDE = ["Валентина", "Володимир", "Andrii Ryzhenko"];

    const AUTO_TEXT = "🙂 готую відповідь…";

    const WAIT_USER_MS = 20000; // ждём 20 сек твоей реакции
    const AUTO_DELAY_MS = 10000; // потом ещё 10 сек до отправки
    const MIN_INTERVAL = 60000; // минимум 60 сек между автоответами в одном треде

    const threadIdMatch = location.pathname.match(/thread\/(\d+)/);
    const THREAD_ID = threadIdMatch ? threadIdMatch[1] : "unknown";

    const LS_MSG = "fh-last-auto-msg-" + THREAD_ID;
    const LS_TIME = "fh-last-auto-time-" + THREAD_ID;

    let pendingUserTimeout = null;
    let pendingAutoTimeout = null;
    let manualMode = false; // если ты начал писать — этот флаг стопит автоответ до ухода с треда

    /******** Звук ********/
    let audioCtx = null;
    function ensureAudio() {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) audioCtx = new AC();
        }
        if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    function beep() {
        const ctx = ensureAudio();
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const c = ctx.createDynamicsCompressor();

        o.frequency.value = 880;
        g.gain.setValueAtTime(0.95, ctx.currentTime);

        c.threshold.setValueAtTime(-6, ctx.currentTime);
        c.knee.setValueAtTime(20, ctx.currentTime);
        c.ratio.setValueAtTime(4, ctx.currentTime);
        c.attack.setValueAtTime(0.003, ctx.currentTime);
        c.release.setValueAtTime(0.1, ctx.currentTime);

        o.connect(g);
        g.connect(c);
        c.connect(ctx.destination);

        o.start();
        o.stop(ctx.currentTime + 0.12);
    }

    function ding() {
        if (!fhGetAutoMode()) return;
        // двойная "тройка"
        beep();
        setTimeout(beep, 250);
        setTimeout(beep, 500);
        setTimeout(beep, 800);
        setTimeout(beep, 1050);
        setTimeout(beep, 1300);
    }

    /******** Работа с чат-сообщениями ********/
    function getMsgs() {
        const box = document.querySelector("#chat-box");
        return box ? Array.from(box.querySelectorAll("li[data-message-id]")) : [];
    }

    function lastMsg() {
        const list = getMsgs();
        return list[list.length - 1] || null;
    }

    function addThreadMark() {
        let marks = [];
        try {
            marks = JSON.parse(localStorage.getItem(FH_LS_MARK_KEY) || "[]");
        } catch (e) {
            marks = [];
        }
        if (!marks.includes(THREAD_ID)) {
            marks.push(THREAD_ID);
            localStorage.setItem(FH_LS_MARK_KEY, JSON.stringify(marks));
        }
        if (typeof setFaviconHeart === "function") {
            setFaviconHeart();
        }
    }

    function blockAutoJumpFor(ms) {
        const until = Date.now() + ms;
        localStorage.setItem(FH_LS_JUMP_BLOCK_UNTIL, String(until));
        console.log("[AutoReply] jump заблокирован до:", new Date(until).toISOString());
    }

    function sendAuto(msgId) {
        const editor = document.querySelector(
            ".fr-element.fr-view[contenteditable='true']"
        );
        const btn = document.querySelector("button[type='submit']");
        if (!editor || !btn) {
            console.log("[AutoReply] нет editor или кнопки отправки");
            return;
        }

        editor.innerHTML = AUTO_TEXT;
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        btn.click();

        ding();

        localStorage.setItem(LS_MSG, msgId);
        localStorage.setItem(LS_TIME, Date.now() + "");

        addThreadMark();

        console.log("[AutoReply] автоответ отправлен →", msgId);

        // Блокируем авто-прыжки на 30 сек, чтобы не было цикла
        blockAutoJumpFor(30000);

        // Возвращаемся на mailbox через ~2 секунды
        setTimeout(() => {
            window.location.href = "/mailbox";
        }, 2000);
    }

    function clearTimers() {
        if (pendingUserTimeout) {
            clearTimeout(pendingUserTimeout);
            pendingUserTimeout = null;
        }
        if (pendingAutoTimeout) {
            clearTimeout(pendingAutoTimeout);
            pendingAutoTimeout = null;
        }
    }

    function cancelAutoForThread(reason) {
        if (manualMode) return;
        manualMode = true;
        clearTimers();
        console.log("[AutoReply] переход в ручной режим, автоответы OFF до выхода (", reason, ")");
    }

    /******** Главный сценарий ********/
    function handleMessage() {
        if (!fhGetAutoMode()) return;
        if (manualMode) {
            // ты уже начал писать / вмешался — до выхода с треда автоответ не работаем
            return;
        }

        const last = lastMsg();
        if (!last) return;

        const msgId = last.getAttribute("data-message-id");
        const authorId = last.getAttribute("data-profile-id");
        const senderName =
            last.querySelector(".profile-name")?.textContent.trim() || "";

        // если последнее сообщение — моё → ничё не делаем
        if (authorId === MY_ID) return;

        // исключения по именам
        if (EXCLUDE.some((n) => senderName.includes(n))) return;

        // анти-дубль по msgId
        const lastAutoMsg = localStorage.getItem(LS_MSG);
        if (lastAutoMsg && lastAutoMsg === msgId) return;

        // троттлинг по времени
        const lastTime = parseInt(localStorage.getItem(LS_TIME) || "0", 10);
        if (lastTime && Date.now() - lastTime < MIN_INTERVAL) {
            console.log("[AutoReply] меньше MIN_INTERVAL → пропуск");
            return;
        }

        // сбрасываем предыдущие таймеры
        clearTimers();

        // ЭТАП 1: ждём твоего действия 20 сек
        pendingUserTimeout = setTimeout(() => {
            if (!fhGetAutoMode() || manualMode) return;

            // ЭТАП 2: после этих 20 сек — ставим таймер на автоответ 10 сек
            pendingAutoTimeout = setTimeout(() => {
                pendingAutoTimeout = null;

                if (!fhGetAutoMode() || manualMode) return;

                const now = lastMsg();
                if (!now) return;
                if (now.getAttribute("data-message-id") !== msgId) return;
                if (now.getAttribute("data-profile-id") === MY_ID) return;

                sendAuto(msgId);
            }, AUTO_DELAY_MS);
        }, WAIT_USER_MS);

        console.log(
            "[AutoReply] поставлен сценарий: 20с ожидание + 10с до автоответа. msgId =",
            msgId
        );
    }

    // Отслеживание чата
    const box = document.querySelector("#chat-box");
    if (box) {
        new MutationObserver(() => {
            console.log("[AutoReply] изменение в чате → проверяю…"); 
            handleMessage();
        }).observe(box, { childList: true, subtree: true });

        // При первой загрузке диалога
        handleMessage();
    } else {
        console.log("[AutoReply] #chat-box не найден");
    }

    // Отслеживание твоей ручной активности в редакторе
    const editor = document.querySelector(
        ".fr-element.fr-view[contenteditable='true']"
    );
    const sendBtn = document.querySelector("button[type='submit']");

    if (editor) {
        editor.addEventListener("keydown", () =>
            cancelAutoForThread("keydown в редакторе")
        );
        editor.addEventListener("input", () =>
            cancelAutoForThread("input в редакторе")
        );
        editor.addEventListener("focus", () =>
            cancelAutoForThread("focus в редакторе")
        );
    }

    if (sendBtn) {
        sendBtn.addEventListener("click", () =>
            cancelAutoForThread("ручная отправка сообщения")
        );
    }
})();

/**********************************************************************
 * 4) MAILBOX — подсветка auto-reply-mark + кнопка очистки
 **********************************************************************/
(function () {
    if (
        !location.pathname.startsWith("/mailbox") ||
        location.pathname.includes("/read/")
    )
        return;

    function loadMarks() {
        try {
            return JSON.parse(localStorage.getItem(FH_LS_MARK_KEY) || "[]");
        } catch (e) {
            return [];
        }
    }

    function applyMarks() {
        const marks = loadMarks();
        if (marks.length) {
            if (typeof setFaviconHeart === "function") {
                setFaviconHeart();
            }
        }
        marks.forEach((id) => {
            const row = document.querySelector(`#thread-${id}`);
            if (row) {
                row.classList.add("auto-reply-mark");
            }
        });
    }

    // Кнопка очистки авто-меток
    const btn = document.createElement("div");
    btn.textContent = "Очистити авто-мітки";
    btn.style.cssText = `
        position:fixed; bottom:60px; right:15px;
        padding:6px 10px; background:#444; color:#fff;
        border-radius:6px; font-size:13px; cursor:pointer;
        opacity:0.85; z-index:999999; font-family:Arial;
    `;
    btn.onmouseenter = () => (btn.style.opacity = "1");
    btn.onmouseleave = () => (btn.style.opacity = "0.85");

    btn.onclick = () => {
        localStorage.removeItem(FH_LS_MARK_KEY);
        if (typeof restoreFavicon === "function") {
            restoreFavicon();
        }
        document
            .querySelectorAll(".auto-reply-mark")
            .forEach((el) => el.classList.remove("auto-reply-mark"));

        console.log("[AutoFH] авто-мітки очищені");
    };

    document.body.appendChild(btn);
    applyMarks();
})();
