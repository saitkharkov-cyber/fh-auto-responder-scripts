// ============================================================================
//  FREELANCEHUNT AUTO ASSISTANT v10 (No-Return Safe Version)
//  Работает в Chrome Script Injector, UserJS, Custom Code, Tampermonkey
// ============================================================================

(function() {

    // -----------------------------------------------------------
    // 0. TOGGLE BUTTON (AUTO MODE ON/OFF)
    // -----------------------------------------------------------
    (function() {
        const KEY = "fh-auto-mode";
        let mode = localStorage.getItem(KEY) || "on";

        const btn = document.createElement("div");
        btn.id = "fh-auto-toggle-btn";
        btn.style = `
            position: fixed;
            bottom: 15px;
            right: 15px;
            z-index: 999999;
            padding: 8px 14px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-family: Arial;
            opacity: 0.85;
            transition: 0.2s;
            box-shadow: 0 0 10px rgba(0,0,0,0.3);
        `;

        function updateButton() {
            if (mode === "on") {
                btn.textContent = "AUTO: ON";
                btn.style.background = "#28a745";
                btn.style.color = "#fff";
            } else {
                btn.textContent = "AUTO: OFF";
                btn.style.background = "#dc3545";
                btn.style.color = "#fff";
            }
        }

        updateButton();
        btn.addEventListener("mouseenter", () => btn.style.opacity = "1");
        btn.addEventListener("mouseleave", () => btn.style.opacity = "0.85");

        btn.addEventListener("click", () => {
            mode = mode === "on" ? "off" : "on";
            localStorage.setItem(KEY, mode);
            updateButton();
            console.log("[AutoFH] режим:", mode);
        });

        document.body.appendChild(btn);
    })();



    // -----------------------------------------------------------
    // Helper: звук
    // -----------------------------------------------------------
    let audioCtx = null;
    const MAX_GAIN = 0.95;

    function ensureAudioCtx() {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            audioCtx = new AC();
        }
        if (audioCtx.state === "suspended") audioCtx.resume();
        return audioCtx;
    }

    function beep() {
        const ctx = ensureAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const comp = ctx.createDynamicsCompressor();

        osc.frequency.value = 880;
        gain.gain.value = MAX_GAIN;

        comp.threshold.value = -6;
        comp.knee.value = 20;
        comp.ratio.value = 4;
        comp.attack.value = 0.003;
        comp.release.value = 0.1;

        osc.connect(gain);
        gain.connect(comp);
        comp.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    }

    function playDingTriple() {
        if (localStorage.getItem("fh-auto-mode") !== "on") return;
        beep(); setTimeout(beep, 250); setTimeout(beep, 500);
        setTimeout(beep, 800); setTimeout(beep, 1050); setTimeout(beep, 1300);
    }

    function log(...a) {
        console.log("%c[AutoFH]", "color:#27ae60;font-weight:bold", ...a);
    }



    // ============================================================
    // 1. MAILBOX LIST (AutoReload + AutoJump)
    // ============================================================

    const isMailboxList =
        location.pathname.startsWith("/mailbox") &&
        !location.pathname.includes("/read/");

    if (isMailboxList) {

        log("AutoJump активирован.");

        const badge = document.querySelector("span[data-unread-message-count]");

        function openUnread() {
            const link = document.querySelector(
                "tr.thread-unread a[href*='/mailbox/read/thread']"
            );
            if (link) {
                log("Открываю непрочитанный тред…");
                playDingTriple();
                link.click();
                return true;
            }
            return false;
        }

        // авто-открытие unread
        setTimeout(() => {
            if (!openUnread()) {
                log("Unread нет → AutoReload через 10 сек");
                setTimeout(() => location.reload(), 10000);
            }
        }, 300);

        // наблюдение за badge
        if (badge) {
            let last = parseInt(badge.textContent.trim() || "0", 10);

            const obsBadge = new MutationObserver(() => {
                const cur = parseInt(badge.textContent.trim() || "0", 10);
                log(`Badge ${last} → ${cur}`);

                if (cur > last) {
                    setTimeout(() => {
                        if (!openUnread()) location.reload();
                    }, 200);
                }

                last = cur;
            });

            obsBadge.observe(badge, { childList: true, subtree: true });
        }
    }



    // =================================================================
    // 2. THREAD PAGE (AutoReply + AutoReturn)
    // =================================================================

    const isThreadPage = location.pathname.includes("/mailbox/read/thread");

    if (!isThreadPage) {
        // В Chrome Custom Script нельзя return → просто пустой блок
    } else {

        const MY_ID = "1826843";
        const EXCLUDE_NAMES = ["Валентина", "Володимир", "Andrii Ryzhenko"];
        const AUTO_REPLY_TEXT = "🙂 готую відповідь…";
        const MIN_INTERVAL = 60000;

        const THREAD_ID = location.pathname.match(/thread\/(\d+)/)?.[1] || "unknown";

        const LS_MSG = "fh-last-auto-msg-" + THREAD_ID;
        const LS_TIME = "fh-last-auto-time-" + THREAD_ID;

        let pendingTimeout = null;
        let pendingMsgId = null;

        function scheduleReturnToMailbox(threadId) {
            log("AutoReturn старт → 30 сек…");

            let typing = false;
            const editor = document.querySelector(".fr-element.fr-view[contenteditable='true']");

            if (editor) {
                const cancel = () => {
                    typing = true;
                    editor.removeEventListener("input", cancel);
                    editor.removeEventListener("keypress", cancel);
                };
                editor.addEventListener("input", cancel);
                editor.addEventListener("keypress", cancel);
            }

            setTimeout(() => {
                if (typing) {
                    log("AutoReturn: отменено");
                    return;
                }
                log("AutoReturn: возврат на mailbox");
                location.href = "/mailbox";
            }, 30000);
        }

        function sendAutoReply(msgId) {
            const editor = document.querySelector(".fr-element.fr-view[contenteditable='true']");
            const sendBtn = document.querySelector("button[type='submit']");
            if (!editor || !sendBtn) return;

            editor.innerHTML = AUTO_REPLY_TEXT;
            sendBtn.click();
            playDingTriple();

            localStorage.setItem(LS_MSG, msgId);
            localStorage.setItem(LS_TIME, Date.now().toString());

            scheduleReturnToMailbox(THREAD_ID);
        }

        function getMessages() {
            return [...document.querySelectorAll("#chat-box li[data-message-id]")];
        }

        function getLastMessage() {
            const m = getMessages();
            return m[m.length - 1] || null;
        }

        function scheduleReplyCheck() {
            if (localStorage.getItem("fh-auto-mode") !== "on") return;

            const last = getLastMessage();
            if (!last) return;

            const msgId = last.getAttribute("data-message-id");
            const authorId = last.getAttribute("data-profile-id");
            const senderName = last.querySelector(".profile-name")?.textContent.trim() || "";

            if (authorId === MY_ID) return;
            if (EXCLUDE_NAMES.some(n => senderName.includes(n))) return;

            if (localStorage.getItem(LS_MSG) === msgId) return;

            const lastTime = parseInt(localStorage.getItem(LS_TIME) || "0", 10);
            if (Date.now() - lastTime < MIN_INTERVAL) return;

            if (pendingTimeout && pendingMsgId !== msgId) {
                clearTimeout(pendingTimeout);
                pendingTimeout = null;
                pendingMsgId = null;
            }

            if (pendingTimeout) return;

            pendingMsgId = msgId;

            pendingTimeout = setTimeout(() => {
                pendingTimeout = null;

                const check = getLastMessage();
                if (!check) return;

                const nowMsg = check.getAttribute("data-message-id");
                const nowAuthor = check.getAttribute("data-profile-id");

                if (nowMsg !== msgId) return;
                if (nowAuthor === MY_ID) return;

                sendAutoReply(msgId);

            }, 10000);
        }

        const chat = document.querySelector("#chat-box");
        if (chat) {
            const obsChat = new MutationObserver(scheduleReplyCheck);
            obsChat.observe(chat, { childList: true, subtree: true });
            scheduleReplyCheck();
        }
    }

})();
