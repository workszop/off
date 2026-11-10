// ---- Today in the office ----
// A short diary of what has happened: who came and went, what people talked
// about, the printer, the donuts. Kept in this browser for the current day,
// so coming back later shows what happened earlier.
//
//   const daylog = createDayLog({ list, count });   // <ol> and a counter badge
//   daylog.add('The printer jammed.');
//   daylog.recent(5)   // -> ['12:04 The printer jammed.', ...]

const KEY = 'offquarium.daylog';
const LIMIT = 80;

const pad = n => String(n).padStart(2, '0');
const dayOf = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const clock = date => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export function createDayLog({ list, count, empty, now = () => new Date() }) {
  let day = dayOf(now());
  let entries = [];
  let unseen = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.day === day && Array.isArray(saved.entries)) {
      entries = saved.entries.filter(e => typeof e?.at === 'string' && typeof e?.text === 'string').slice(-LIMIT);
    }
  } catch { /* nothing saved, or storage is unavailable */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ day, entries })); } catch { /* private mode */ }
  }
  function row(entry) {
    const item = document.createElement('li');
    const at = document.createElement('time');
    at.textContent = entry.at;
    item.append(at, ` ${entry.text}`);
    return item;
  }
  function render() {
    list.replaceChildren(...entries.map(row));
    if (empty) empty.hidden = entries.length > 0;
    list.scrollTop = list.scrollHeight;
  }
  function badge() {
    if (!count) return;
    count.textContent = unseen ? String(Math.min(unseen, 99)) : '';
    count.hidden = !unseen;
  }
  render();
  badge();

  return {
    get entries() { return entries; },
    add(text) {
      const date = now();
      if (dayOf(date) !== day) { day = dayOf(date); entries = []; list.replaceChildren(); }
      const entry = { at: clock(date), text };
      entries.push(entry);
      if (entries.length > LIMIT) { entries.shift(); list.firstChild?.remove(); }
      const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 8;
      list.appendChild(row(entry));
      if (atEnd) list.scrollTop = list.scrollHeight;
      if (empty) empty.hidden = true;
      unseen++;
      badge();
      save();
    },
    // The visitor has looked at the log.
    seen() { unseen = 0; badge(); list.scrollTop = list.scrollHeight; },
    recent(n) { return entries.slice(-n).map(e => `${e.at} ${e.text}`); },
  };
}
