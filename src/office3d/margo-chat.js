// ---- Talk to Margo ----
// The chat panel. Messages go to the chat proxy (worker/margo), which adds
// Margo's persona and calls the model through OpenRouter. With no endpoint configured, the
// panel still works and Margo explains, in character, that she's offline.
// The proxy needs a password: the panel asks for it once, checks it with
// /auth, and remembers it in this browser (localStorage).
//
// DOM contract: #margoChat[data-lock] is "offline", "locked" or "unlocked".
//
//   const chat = initMargoChat({ endpoint, offlineLines, onOpenChange, onReply });
//   chat.open();

const GREETING = 'Status: available. Enthusiasm: pending. What do you need?';
const ERRORS = {
  429: "Too many messages. Rate limiter engaged. I didn't make the rules. I agree with them, though.",
  default: 'Connection dropped. Not my fault. Probably. Try again in a moment.',
};
const LOCKED_GREETING = "Access control engaged. Password first. I didn't make the rules. Fine, I made this one.";
const PASSWORD_LINES = {
  granted: 'Password accepted. Enthusiasm: pending. What do you need?',
  wrong: "Password rejected. Try again, or don't. Episode 212 isn't going to watch itself.",
  expired: 'My password changed and yours did not. Enter the new one.',
};
const PASSWORD_KEY = 'offquarium.margoPassword';
const TIMEOUT_MS = 30_000;
const HISTORY_LIMIT = 16; // matches the proxy's limit

export function initMargoChat({ endpoint, offlineLines, onOpenChange = () => {}, onReply = () => {} }) {
  const panel = document.getElementById('margoChat');
  const button = document.getElementById('talkMargo');
  const log = document.getElementById('margoLog');
  const form = document.getElementById('margoForm');
  const input = document.getElementById('margoInput');
  const send = form.querySelector('button[type="submit"]');
  const status = document.getElementById('margoStatus');
  const closeBtn = document.getElementById('margoClose');
  const label = form.querySelector('label');
  const authEndpoint = endpoint.replace(/\/chat$/, '/auth');

  const store = {
    get() { try { return localStorage.getItem(PASSWORD_KEY) || ''; } catch { return ''; } },
    set(value) { try { value ? localStorage.setItem(PASSWORD_KEY, value) : localStorage.removeItem(PASSWORD_KEY); } catch { /* private mode */ } },
  };
  let password = endpoint ? store.get() : '';
  let lock = !endpoint ? 'offline' : password ? 'unlocked' : 'locked';

  const idleStatus = () => ({
    offline: 'Office construct · chat link not connected',
    locked: 'Office construct · password needed',
    unlocked: 'Office construct · reluctantly available',
  })[lock];

  // Locked: the message box becomes a password box.
  function setLock(next) {
    lock = next;
    panel.dataset.lock = lock;
    const locked = lock === 'locked';
    input.type = locked ? 'password' : 'text';
    input.placeholder = locked ? 'Password' : 'Say something to Margo';
    input.autocomplete = locked ? 'current-password' : 'off';
    label.textContent = locked ? 'Password for Margo' : 'Message Margo';
    status.textContent = idleStatus();
  }
  setLock(lock);

  // Only real exchanges with the API are kept, so history always alternates
  // user / assistant as the API requires.
  const history = [];
  let busy = false;

  function add(who, text) {
    const item = document.createElement('li');
    item.className = `margo-msg margo-msg--${who}`;
    item.textContent = text;
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }

  function setBusy(on) {
    busy = on;
    send.disabled = on;
    status.textContent = on ? 'Processing. Reluctantly…' : idleStatus();
  }

  async function post(url, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Margo-Password': password },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // Returns a reply line for the log.
  async function unlock(candidate) {
    password = candidate;
    try {
      const res = await post(authEndpoint, {});
      if (res.ok) {
        store.set(password);
        setLock('unlocked');
        return PASSWORD_LINES.granted;
      }
      password = '';
      return res.status === 401 ? PASSWORD_LINES.wrong : ERRORS[res.status] ?? ERRORS.default;
    } catch {
      password = '';
      return ERRORS.default;
    }
  }

  async function ask(messages) {
    if (!endpoint) {
      await new Promise(r => setTimeout(r, 600));
      return { reply: offlineLines[Math.floor(Math.random() * offlineLines.length)], real: false };
    }
    try {
      const res = await post(endpoint, { messages: messages.slice(-HISTORY_LIMIT) });
      if (res.status === 401) {
        // The stored password no longer works: forget it and ask again.
        password = '';
        store.set('');
        setLock('locked');
        return { reply: PASSWORD_LINES.expired, real: false };
      }
      if (!res.ok) return { reply: ERRORS[res.status] ?? ERRORS.default, real: false };
      const data = await res.json();
      return typeof data.reply === 'string' && data.reply
        ? { reply: data.reply, real: true }
        : { reply: ERRORS.default, real: false };
    } catch {
      return { reply: ERRORS.default, real: false };
    }
  }

  async function submit(event) {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    if (lock === 'locked') {
      add('you', '•'.repeat(Math.min(text.length, 12))); // never show the password
      setBusy(true);
      const reply = await unlock(text);
      add('margo', reply);
      onReply(reply);
      setBusy(false);
      input.focus();
      return;
    }
    add('you', text);
    history.push({ role: 'user', content: text });
    setBusy(true);
    const { reply, real } = await ask(history);
    if (real) history.push({ role: 'assistant', content: reply });
    else history.pop(); // keep history to completed exchanges only
    add('margo', reply);
    onReply(reply);
    setBusy(false);
    input.focus();
  }

  function open() {
    if (!panel.hidden) { input.focus(); return; }
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    if (!log.children.length) add('margo', lock === 'locked' ? LOCKED_GREETING : GREETING);
    input.focus();
    onOpenChange(true);
  }

  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.focus();
    onOpenChange(false);
  }

  button.addEventListener('click', () => (panel.hidden ? open() : close()));
  closeBtn.addEventListener('click', close);
  form.addEventListener('submit', submit);
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  return { open, close, get isOpen() { return !panel.hidden; } };
}
