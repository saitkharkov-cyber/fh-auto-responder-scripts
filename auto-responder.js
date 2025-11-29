/******************************************************
 * FREELANCEHUNT — UI: AUTO BUTTON + CLEAR MARKS + CSS
 ******************************************************/
(function() {
    const KEY = "fh-auto-mode";
    let mode = localStorage.getItem(KEY) || "on";

    // ----- Кнопка AUTO ON/OFF -----
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
    btn.onmouseenter = () => btn.style.opacity = "1";
    btn.onmouseleave = () => btn.style.opacity = "0.85";

    btn.onclick = () => {
        mode = mode === "on" ? "off" : "on";
        localStorage.setItem(KEY, mode);
        btn.textContent = mode === "on" ? "AUTO: ON" : "AUTO: OFF";
        btn.style.background = mode === "on" ? "#28a745" : "#dc3545";
        console.log("[AutoFH] режим переключён →", mode);
    };

    document.body.appendChild(btn);

    // ----- Кнопка CLEAR MARKS -----
    const clearBtn = document.createElement("div");
    clearBtn.id = "fh-auto-clear-marks";
    clearBtn.textContent = "CLEAR MARKS";
    clearBtn.style.cssText = `
        position:fixed; bottom:52px; right:15px; z-index:999999;
        padding:6px 12px; border-radius:8px;
        font-family:Arial; font-size:12px; cursor:pointer;
        color:#fff; box-shadow:0 0 8px rgba(0,0,0,0.25);
        background:#6c757d;
        opacity:0.85; transition:0.2s;
    `;
    clearBtn.onmouseenter = () => clearBtn.style.opacity = "1";
    clearBtn.onmouseleave = () => clearBtn.style.opacity = "0.85";

    function clearAutoMarks() {
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("fh-auto-mark-")) {
                toRemove.push(key);
            }
        }
        toRemove.forEach(k => localStorage.removeItem(k));

        document
            .querySelectorAll("tr.auto-reply-mark")
            .forEach(tr => tr.classList.remove("auto-reply-mark"));

        console.log("[AutoFH] Очищены все авто-метки");
    }

    clearBtn.onclick = clearAutoMarks;
    document.body.appendChild(clearBtn);

    // Делаем доступной функцию (если понадобится где-то ещё)
    window.FH_clearAutoMarks = clearAutoMarks;

    // ----- CSS для подсветки auto-reply тредов -----
    const style = document.createElement("style");
    style.textContent = `
        tr.auto-reply-mark {
            background-color: rgba(255, 230, 150, 0.45) !important;
        }
    `;
    (document.head || document.documentElement).appendChild(style);
})();

/******************************************************
 * FREELANCEHUNT — AutoJump v8 (Mailbox + авто-марки)
 ******************************************************/
(function () {
    "use strict";

    const isMailboxList =
        location.pathname.startsWith("/mailbox") &&
        !location.pathname.includes("/read/");

    if (!isMailboxList) return;

    console.log("[AutoJump v8] работа на /mailbox");

    const AUTO_MODE = () => localStorage.getItem("fh-auto-mode") === "on";

    // ----- звук при переходе в диалог -----
    function playDing() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0.5;
            osc.frequency.value = 880;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch (e) {}
    }

    // ----- применяем подсветку по данным из localStorage -----
    function applyAutoMarksFromStorage() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith("fh-auto-mark-")) continue;

            const threadId = key.substring("fh-auto-mark-".length);
            const row = document.getElementById("thread-" + threadId);
            if (row) {
                row.classList.add("auto-reply-mark");
            }
        }
    }

    // ----- попытка открыть первый unread -----
    function tryOpenUnread() {
        const row = document.querySelector("tr.thread-unread");
        if (!row) {
            console.log("[AutoJump] unread не найден");
            return false;
        }

        const link =
            row.querySelector("a[href*='/mailbox/read/thread']") ||
            row.querySelector("a[href*='/mailbox/read/']") ||
            row.querySelector("a[href*='thread/']");

        if (!link) {
            console.log("[AutoJump] ссылка внутри unread не найдена");
            return false;
        }

        console.log("[AutoJump] открываю unread →", link.href);
        playDing();
        link.click();
        return true;
    }

    // ----- badge -----
    const badge = document.querySelector("span[data-unread-message-count]");
    if (!badge) {
        console.log("[AutoJump] badge не найден");
        // но подсветку авто-марок всё равно применим
        window.addEventListener("load", () => {
            setTimeout(applyAutoMarksFromStorage, 200);
        });
        return;
    }

    let lastVal = parseInt(badge.textContent.trim() || "0", 10);

    const obs = new MutationObserver(() => {
        const curVal = parseInt(badge.textContent.trim() || "0", 10);
        console.log(`[AutoJump] badge: ${lastVal} → ${curVal}`);

        if (!AUTO_MODE()) {
            lastVal = curVal;
            return;
        }

        if (curVal > lastVal) {
            console.log("[AutoJump] новое сообщение!");
            setTimeout(() => {
                if (!tryOpenUnread()) {
                    console.log("[AutoJump] unread нет → reload");
                    location.reload();
                }
            }, 200);
        }

        lastVal = curVal;
    });

    obs.observe(badge, {
        childList: true,
        characterData: true,
        subtree: true
    });

    // при загрузке страницы после возможного reload — подсветка + попытка открыть
    window.addEventListener("load", () => {
        setTimeout(() => {
            applyAutoMarksFromStorage();
            if (AUTO_MODE()) {
                tryOpenUnread();
            }
        }, 300);
    });

})();

/******************************************************
 * FREELANCEHUNT — AutoReply v5 (20s + 10s + mark + back)
 ******************************************************/
(function () {
    "use strict";

    if (!location.pathname.includes("/mailbox/read/thread")) return;

    console.log("[AutoReply v5] активирован на странице диалога");

    const AUTO_MODE = () => localStorage.getItem("fh-auto-mode") === "on";

    const MY_ID = "1826843";
    const EXCLUDE_NAMES = ["Валентина", "Володимир", "Andrii Ryzhenko"];
    const AUTO_TEXT = "🙂 готую відповідь…";
    const PRE_DELAY_MS = 20000;   // 20 секунд до автоответа
    const REDIRECT_DELAY_MS = 10000; // 10 секунд до возврата на mailbox
    const MIN_INTERVAL = 60000;   // минимум 60 секунд между автоответами в одном треде

    const threadId = location.pathname.match(/thread\/(\d+)/)?.[1] || "unknown";
    const LS_LAST_MSG = "fh-last-auto-msg-" + threadId;
    const LS_LAST_TIME = "fh-last-auto-time-" + threadId;
    const LS_MARK_KEY = "fh-auto-mark-" + threadId;

    let preTimer = null;
    let preMsgId = null;
    let redirectTimer = null;
    let lastSeenMsgId = null;
    let justSentAuto = false;

    function log(...args) {
        console.log("%c[AutoFH]", "color:#27ae60;font-weight:bold", ...args);
    }

    /************** звук (тот же “дзынь-дзелень”) **************/
    let audioCtx = null;
    function ensureCtx() {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) audioCtx = new AC();
        }
        if (audioCtx?.state === "suspended") audioCtx.resume().catch(() => {});
        return audioCtx;
    }

    function beep() {
        const ctx = ensureCtx();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.95, ctx.currentTime);

        comp.threshold.setValueAtTime(-6, ctx.currentTime);
        comp.knee.setValueAtTime(20, ctx.currentTime);
        comp.ratio.setValueAtTime(4, ctx.currentTime);
        comp.attack.setValueAtTime(0.003, ctx.currentTime);
        comp.release.setValueAtTime(0.1, ctx.currentTime);

        osc.connect(gain);
        gain.connect(comp);
        comp.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    }

    function ding() {
        if (!AUTO_MODE()) return;
        beep(); setTimeout(beep, 250); setTimeout(beep, 500);
        setTimeout(beep, 800); setTimeout(beep, 1050); setTimeout(beep, 1300);
    }

    /************** полезные функции **************/
    function getMsgs() {
        const box = document.querySelector("#chat-box");
        return box ? Array.from(box.querySelectorAll("li[data-message-id]")) : [];
    }

    function lastMsg() {
        const arr = getMsgs();
        return arr[arr.length - 1] || null;
    }

    function cancelAllTimers(reason) {
        if (preTimer) {
            clearTimeout(preTimer);
            preTimer = null;
            preMsgId = null;
        }
        if (redirectTimer) {
            clearTimeout(redirectTimer);
            redirectTimer = null;
        }
        if (reason) {
            log("Таймеры отменены:", reason);
        }
    }

    function markThreadAsAutoReplied() {
        // помечаем в localStorage
        localStorage.setItem(LS_MARK_KEY, "1");
    }

    function redirectToMailbox() {
        if (!AUTO_MODE()) {
            log("AUTO OFF → возврат на mailbox отменён");
            return;
        }
        log("Перехожу назад на /mailbox после автоответа");
        window.location.href = "/mailbox";
    }

    function scheduleRedirect() {
        if (redirectTimer) {
            clearTimeout(redirectTimer);
            redirectTimer = null;
        }
        redirectTimer = setTimeout(() => {
            redirectTimer = null;

            // Перед редиректом убеждаемся, что режим всё ещё ON
            if (!AUTO_MODE()) {
                log("AUTO OFF перед редиректом → не перехожу на mailbox");
                return;
            }

            redirectToMailbox();
        }, REDIRECT_DELAY_MS);
        log("Таймер возврата на mailbox поставлен на", REDIRECT_DELAY_MS, "мс");
    }

    function sendAuto(msgId) {
        const editor = document.querySelector(".fr-element.fr-view[contenteditable='true']");
        const btn = document.querySelector("button[type='submit']");
        if (!editor || !btn) {
            log("AutoReply: нет editor или sendBtn");
            return;
        }

        editor.innerHTML = AUTO_TEXT;
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        justSentAuto = true; // чтобы не считать это ручным ответом

        btn.click();

        ding();

        localStorage.setItem(LS_LAST_MSG, msgId);
        localStorage.setItem(LS_LAST_TIME, Date.now() + "");

        markThreadAsAutoReplied();

        log("Автоответ отправлен →", msgId);

        // после автоответа — запускаем таймер возврата на mailbox
        scheduleRedirect();
    }

    function scheduleForClientMessage(msgEl) {
        if (!AUTO_MODE()) {
            log("AUTO OFF → автоответ не планируется");
            return;
        }

        const msgId = msgEl.getAttribute("data-message-id");
        const author = msgEl.getAttribute("data-profile-id");

        if (author === MY_ID) return;

        const nameEl = msgEl.querySelector(".profile-name");
        const senderName = nameEl ? nameEl.textContent.trim() : "";
        if (EXCLUDE_NAMES.some(n => senderName.includes(n))) {
            log("Отправитель в исключениях → автоответ не ставлю");
            return;
        }

        const lastAutoMsg = localStorage.getItem(LS_LAST_MSG);
        if (lastAutoMsg === msgId) {
            log("На это сообщение уже был автоответ → пропуск");
            return;
        }

        const lastTime = parseInt(localStorage.getItem(LS_LAST_TIME) || "0", 10);
        if (lastTime && Date.now() - lastTime < MIN_INTERVAL) {
            log("Ещё не прошло MIN_INTERVAL между автоответами → пропуск");
            return;
        }

        // если уже есть таймер на другое сообщение → сбрасываем
        if (preTimer && preMsgId !== msgId) {
            clearTimeout(preTimer);
            preTimer = null;
            preMsgId = null;
            log("Новый msgId от клиента → старый таймер автоответа сброшен");
        }

        // если был таймер на редирект (мы уже автоответили, но клиент написал новое) —
        // отменяем редирект и остаёмся в диалоге
        if (redirectTimer) {
            clearTimeout(redirectTimer);
            redirectTimer = null;
            log("Клиент написал новое сообщение → отменяю отложенный возврат на mailbox");
        }

        if (preTimer && preMsgId === msgId) {
            log("Таймер автоответа уже поставлен для этого msgId");
            return;
        }

        preMsgId = msgId;
        preTimer = setTimeout(() => {
            preTimer = null;

            if (!AUTO_MODE()) {
                log("AUTO OFF к моменту срабатывания таймера → автоответ отменён");
                return;
            }

            const now = lastMsg();
            if (!now) {
                log("По таймеру: сообщений уже нет → отмена");
                return;
            }

            const nowId = now.getAttribute("data-message-id");
            const nowAuthor = now.getAttribute("data-profile-id");

            if (nowId !== msgId) {
                log("По таймеру: последнее сообщение уже другое → отмена");
                return;
            }
            if (nowAuthor === MY_ID) {
                log("По таймеру: последнее сообщение моё → отмена");
                return;
            }

            sendAuto(msgId);

        }, PRE_DELAY_MS);

        log("Поставлен 20-секундный таймер автоответа для msgId =", msgId);
    }

    function onManualAction(reason) {
        cancelAllTimers(reason || "ручное действие");
    }

    /************** отслеживаем ввод в редакторе как ручное действие **************/
    const editor = document.querySelector(".fr-element.fr-view[contenteditable='true']");
    if (editor) {
        const manualHandler = () => {
            // если пользователь явно что-то вводит — отменяем все таймеры
            onManualAction("пользователь начал печатать");
        };
        editor.addEventListener("input", manualHandler);
        editor.addEventListener("keydown", manualHandler);
    }

    /************** отслеживаем изменения в чате **************/
    const box = document.querySelector("#chat-box");
    if (!box) {
        log("AutoReply: #chat-box не найден");
        return;
    }

    const chatObserver = new MutationObserver(() => {
        const last = lastMsg();
        if (!last) return;

        const msgId = last.getAttribute("data-message-id");
        const author = last.getAttribute("data-profile-id");

        if (msgId === lastSeenMsgId) return;
        lastSeenMsgId = msgId;

        const bodyEl = last.querySelector(".message-body");
        const bodyText = bodyEl ? bodyEl.innerText.trim() : "";

        if (author === MY_ID) {
            // если это именно наш автоответ — не считаем его ручным
            if (bodyText === AUTO_TEXT || bodyText.includes("готую відповідь")) {
                justSentAuto = false;
                log("Обнаружен автоответ (моё сообщение), таймеры не трогаю");
                return;
            } else {
                // пользователь что-то написал сам
                onManualAction("пользователь отправил ручной ответ");
                return;
            }
        } else {
            // это сообщение клиента / системы → пробуем поставить автоответ
            scheduleForClientMessage(last);
        }
    });

    chatObserver.observe(box, {
        childList: true,
        subtree: true
    });

    // при первой загрузке — на случай, если уже есть последнее сообщение от клиента
    (function initialCheck() {
        const last = lastMsg();
        if (!last) return;
        const author = last.getAttribute("data-profile-id");
        if (author !== MY_ID) {
            scheduleForClientMessage(last);
        }
    })();

})();
