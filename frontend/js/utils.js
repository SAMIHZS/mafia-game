/**
 * frontend/js/utils.js
 * Shared utility functions for the frontend.
 */

// ─── DOM Helpers ──────────────────────────────────────────────

/** Get an element by ID. Throws if not found. */
function el(id) {
    const elem = document.getElementById(id);
    if (!elem) throw new Error(`Element #${id} not found`);
    return elem;
}

/** Get element(s) by selector (returns NodeList). */
function qs(selector, parent = document) {
    return parent.querySelector(selector);
}

/** Set element text content safely. */
function setText(id, text) {
    const elem = document.getElementById(id);
    if (elem) elem.textContent = text;
}

/** Show or hide an element. */
function setVisible(id, visible) {
    const elem = document.getElementById(id);
    if (elem) elem.classList.toggle('hidden', !visible);
}

// ─── Toast Notifications ──────────────────────────────────────

let toastContainer = null;

function getToastContainer() {
    if (!toastContainer) {
        toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
    }
    return toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} type
 * @param {number} durationMs
 */
function showToast(message, type = 'info', durationMs = 3000) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = '300ms ease';
        setTimeout(() => toast.remove(), 300);
    }, durationMs);
}

// ─── Validation ──────────────────────────────────────────────

/**
 * Validate a room code: 8 alphanumeric chars.
 * @param {string} code
 */
function isValidRoomCode(code) {
    return /^[A-Za-z0-9]{8}$/.test(code);
}

/**
 * Validate a player name: 2-20 chars, letters/numbers/spaces only.
 * @param {string} name
 */
function isValidPlayerName(name) {
    const trimmed = (name || '').trim();
    return /^[a-zA-Z0-9 ]{2,20}$/.test(trimmed);
}

// ─── Player Initials Avatar ───────────────────────────────────

/** Return uppercase initials for a name. */
function getInitials(name) {
    return (name || '?').trim().charAt(0).toUpperCase();
}

// ─── Clipboard ───────────────────────────────────────────────

/**
 * Copy text to clipboard. Returns true on success.
 * @param {string} text
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    }
}

// ─── Misc ─────────────────────────────────────────────────────

/** Format seconds as MM:SS string. */
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Show form field error. */
function showFieldError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    if (input) input.classList.add('error');
    if (error) {
        error.textContent = `⚠️ ${message}`;
        error.classList.remove('hidden');
    }
}

/** Clear form field error. */
function clearFieldError(inputId, errorId) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    if (input) input.classList.remove('error');
    if (error) {
        error.textContent = '';
        error.classList.add('hidden');
    }
}

// Export as global (no module system on frontend)
window.Utils = {
    el, qs, setText, setVisible,
    showToast,
    isValidRoomCode, isValidPlayerName,
    getInitials,
    copyToClipboard,
    formatTime,
    showFieldError, clearFieldError
};
