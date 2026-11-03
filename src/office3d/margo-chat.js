// ---- Talk to Margo ----
// The chat panel. Messages go to the chat proxy (worker/margo), which adds
// Margo's persona and calls the model through OpenRouter. With no endpoint configured, the
// panel still works and Margo explains, in character, that she's offline.
//
//   const chat = initMargoChat({ endpoint, offlineLines, onOpenChange, onReply });
//   chat.open();

const GREETING = 'Status: available. Enthusiasm: pending. What do you need?';
const ERRORS = {
  429: "Too many messages. Rate limiter engaged. I didn't make the rules. I agree with them, though.",
  default: 'Connection dropped. Not my fault. Probably. Try again in a moment.',
};
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
  const idleStatus = endpoint ? 'Office construct · reluctantly available' : 'Office construct · chat link not connected';
  status.textContent = idleStatus;

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
    status.textContent = on ? 'Processing. Reluctantly…' : idleStatus;
  }

  async function ask(messages) {
    if (!endpoint) {
      await new Promise(r => setTimeout(r, 600));
      return { reply: offlineLines[Math.floor(Math.random() * offlineLines.length)], real: false };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.slice(-HISTORY_LIMIT) }),
        signal: controller.signal,
      });
      if (!res.ok) return { reply: ERRORS[res.status] ?? ERRORS.default, real: false };
      const data = await res.json();
      return typeof data.reply === 'string' && data.reply
        ? { reply: data.reply, real: true }
        : { reply: ERRORS.default, real: false };
    } catch {
      return { reply: ERRORS.default, real: false };
    } finally {
      clearTimeout(timer);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
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
    if (!log.children.length) add('margo', GREETING);
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
