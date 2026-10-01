/**
 * Мини-парсер markdown → DOM-узлы (без innerHTML для пользовательских данных).
 * Поддержка: **bold**, *italic*, `code`, ~~strike~~, ||spoiler||, ```block```, > quote, автоссылки, @mentions, #tags
 */

const URL_RE = /(https?:\/\/[^\s<]+)/g;
const MENTION_RE = /@([a-zA-Z0-9_]{2,32})/g;
const TAG_RE = /#([a-zA-Zа-яА-Я0-9_]{2,32})/g;

export function renderMarkdown(text) {
  const frag = document.createDocumentFragment();
  if (!text) return frag;

  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trim().startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      frag.append(createEl('pre', codeLines.join('\n')));
      continue;
    }

    // Quote
    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      const quote = createEl('blockquote', quoteLines.join('\n'));
      quote.style.cssText = 'border-left:3px solid var(--color-accent);padding-left:8px;opacity:.85;margin:4px 0;';
      frag.append(quote);
      continue;
    }

    frag.append(renderInline(line));
    i++;
    if (i < lines.length) frag.append(document.createTextNode('\n'));
  }

  return frag;
}

function renderInline(text) {
  const container = document.createDocumentFragment();
  const tokens = tokenize(text);
  for (const tok of tokens) {
    if (typeof tok === 'string') { container.append(document.createTextNode(tok)); continue; }
    container.append(tok);
  }
  return container;
}

function tokenize(text) {
  const parts = [];
  let rest = text;

  while (rest.length > 0) {
    // ```code```
    let m = rest.match(/^```([^`]+)```/);
    if (m) { parts.push(createEl('code', m[1])); rest = rest.slice(m[0].length); continue; }

    // ||spoiler||
    m = rest.match(/^\|\|([^|]+)\|\|/);
    if (m) { parts.push(createSpoiler(m[1])); rest = rest.slice(m[0].length); continue; }

    // **bold**
    m = rest.match(/^\*\*([^*]+)\*\*/);
    if (m) { parts.push(createEl('strong', m[1], 'textContent')); rest = rest.slice(m[0].length); continue; }

    // *italic*
    m = rest.match(/^\*([^*\n]+)\*/);
    if (m) { parts.push(createEl('em', m[1], 'textContent')); rest = rest.slice(m[0].length); continue; }

    // `code`
    m = rest.match(/^`([^`]+)`/);
    if (m) { parts.push(createEl('code', m[1])); rest = rest.slice(m[0].length); continue; }

    // ~~strike~~
    m = rest.match(/^~~([^~]+)~~/);
    if (m) {
      const s = document.createElement('s');
      s.textContent = m[1];
      parts.push(s);
      rest = rest.slice(m[0].length);
      continue;
    }

    // URL
    m = rest.match(/^(https?:\/\/[^\s<]+)/);
    if (m) {
      const a = document.createElement('a');
      a.href = m[1];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = m[1];
      parts.push(a);
      rest = rest.slice(m[0].length);
      continue;
    }

    // @mention
    m = rest.match(/^@([a-zA-Z0-9_]{2,32})/);
    if (m) {
      const span = document.createElement('span');
      span.style.cssText = 'color:var(--color-accent);font-weight:500;';
      span.textContent = '@' + m[1];
      parts.push(span);
      rest = rest.slice(m[0].length);
      continue;
    }

    // #tag
    m = rest.match(/^#([a-zA-Zа-яА-Я0-9_]{2,32})/);
    if (m) {
      const span = document.createElement('span');
      span.style.cssText = 'color:var(--color-accent);';
      span.textContent = '#' + m[1];
      parts.push(span);
      rest = rest.slice(m[0].length);
      continue;
    }

    // Обычный символ
    parts.push(rest[0]);
    rest = rest.slice(1);
  }

  return parts;
}

function createEl(tag, content, mode = 'textContent') {
  const node = document.createElement(tag);
  node[mode] = content;
  return node;
}

function createSpoiler(content) {
  const span = document.createElement('span');
  span.className = 'spoiler';
  span.textContent = content;
  span.addEventListener('click', () => span.classList.toggle('is-open'), { once: false });
  return span;
}

/** Извлечь plain text из markdown (для превью) */
export function stripMarkdown(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, '[код]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*~]/g, '')
    .replace(/\|\|([^|]+)\|\|/g, '$1');
}
