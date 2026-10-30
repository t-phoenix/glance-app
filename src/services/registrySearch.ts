export interface RegistryPerson {
  value: string;
  displayName: string;
  bio: string | null;
}

const TELEGRAM = /^[A-Za-z0-9_]{4,32}$/;

/** Public Telegram usernames from global-search rows. Channels without a username are skipped. */
export function telegramPeopleFromRows(rows: { title: string; subtitle: string }[]): RegistryPerson[] {
  const found: RegistryPerson[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const title = row.title.replace(/\s+/g, ' ').trim();
    const subtitle = row.subtitle.replace(/\s+/g, ' ').trim();
    const handle = subtitle.match(/@([A-Za-z0-9_]{4,32})/)?.[1] ?? '';
    if (!TELEGRAM.test(handle) || !title || seen.has(handle.toLowerCase())) continue;
    seen.add(handle.toLowerCase());
    const bio = subtitle.replace(new RegExp(`@${handle}`, 'i'), '').trim();
    found.push({ value: handle, displayName: title, bio: bio || null });
    if (found.length >= 20) break;
  }
  return found;
}

/** WhatsApp contacts the signed-in account can already see. */
export function whatsAppContactsFromRows(rows: { name: string; id: string }[]): RegistryPerson[] {
  const found: RegistryPerson[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const phone = row.id.match(/(\d{6,15})@c\.us/)?.[1] ?? '';
    const name = row.name.replace(/\s+/g, ' ').trim();
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    found.push({ value: `+${phone}`, displayName: name && name !== `+${phone}` ? name : `+${phone}`, bio: null });
    if (found.length >= 20) break;
  }
  return found;
}

export function telegramExtractScript(query: string): string {
  return `(function () {
    function send(payload) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
    var input = document.querySelector('#telegram-search-input, .input-search input');
    if (!input) { send({ query: ${JSON.stringify(query)}, login: true }); return true; }
    var setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setValue.call(input, ${JSON.stringify(query)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(function () {
      var rows = [];
      var items = document.querySelectorAll('.ListItem, .search-result, [data-peer-id]');
      for (var i = 0; i < items.length && rows.length < 30; i++) {
        var item = items[i];
        var title = ((item.querySelector('.title, h3, .fullName') || {}).innerText || '').trim();
        var subtitle = ((item.querySelector('.subtitle, .handle, .status') || {}).innerText || '').trim();
        if (title || subtitle) rows.push({ title: title, subtitle: subtitle });
      }
      send({ query: ${JSON.stringify(query)}, rows: rows, login: false });
    }, 1400);
    return true;
  })(); true;`;
}

export function whatsAppExtractScript(query: string): string {
  const digits = query.replace(/[^\d]/g, '');
  const phone = digits.length >= 8 && digits.length <= 15 ? digits : '';
  return `(function () {
    function send(payload) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
    var loggedIn = !!(document.querySelector('#pane-side') || document.querySelector('[data-testid="chat-list"]') || document.querySelector('#side'));
    if (!loggedIn) { send({ query: ${JSON.stringify(query)}, login: true }); return true; }
    ${phone ? `if (sessionStorage.getItem('glance-wa') !== ${JSON.stringify(phone)}) {
      sessionStorage.setItem('glance-wa', ${JSON.stringify(phone)});
      location.href = 'https://web.whatsapp.com/send?phone=${phone}';
      return true;
    }
    var header = document.querySelector('header span[title]');
    var name = header ? (header.getAttribute('title') || header.textContent || '') : '';
    send({ query: ${JSON.stringify(query)}, contacts: [{ name: name || ${JSON.stringify(`+${phone}`)}, id: '${phone}@c.us' }], login: false });
    return true;` : `var box = document.querySelector('#side div[contenteditable="true"]') || document.querySelector('[data-tab="3"]') || document.querySelector('div[aria-label*="Search"]');
    if (box) {
      box.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, ${JSON.stringify(query)});
    }
    setTimeout(function () {
      var contacts = [];
      var items = document.querySelectorAll('#pane-side [role="listitem"], #side [role="listitem"], [data-testid="cell-frame-container"]');
      for (var i = 0; i < items.length && contacts.length < 30; i++) {
        var item = items[i];
        var id = item.getAttribute('data-id') || ((item.querySelector('[data-id]') || {}).getAttribute && item.querySelector('[data-id]').getAttribute('data-id')) || '';
        var titled = item.querySelector('span[title]');
        var name = titled ? (titled.getAttribute('title') || '') : '';
        if (id || name) contacts.push({ name: name, id: id });
      }
      send({ query: ${JSON.stringify(query)}, contacts: contacts, login: false });
    }, 900);
    return true;`}
  })(); true;`;
}
