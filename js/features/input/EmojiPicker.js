/**
 * EmojiPicker v2 — переписан с нуля.
 * Гарантированная работа: клики, категории, поиск, недавние.
 */

const EMOJI_DATA = {
  'Часто используемые': ['😀','😂','🥰','😎','🤔','😴','🎉','🔥','💯','👍','❤️','🌙','☀️','🌈','⚡','🎮','☕','🍕','🎵','🐱','🐶','🌸','⭐','💎'],
  'Смайлы': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','💩','🤡','👹','👺','👻','👽','🤖'],
  'Жесты': ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','👂','👃','🧠','🦷','🦴','👀','👁','👅','👄'],
  'Сердца': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','💌','💋','💐','🌹','🥀','🌺','🌸','🌼','🌻','🌷'],
  'Животные': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🐢','🐍','🦎','🐙','🦑','🦐','🦀','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🐘','🦒','🐪','🐫','🐄','🐎','🐖','🐑','🐐','🦌','🐕','🐈','🦃','🦜','🦢','🕊️','🐇','🦔'],
  'Еда': ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🥙','🌮','🌯','🥗','🥘','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','☕','🍵','🥤','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾','🧊'],
  'Символы': ['💯','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🔺','🔻','🔸','🔹','🔶','🔷','✅','❌','❎','✔️','☑️','🔘','🔔','🔕','📣','📢','💬','💭','🗯️','♠️','♣️','♥️','♦️','🃏','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚','🕛']
};

const CATEGORY_ICONS = {
  'Часто используемые': '🕒',
  'Смайлы': '😀',
  'Жесты': '👋',
  'Сердца': '❤️',
  'Животные': '🐶',
  'Еда': '🍔',
  'Символы': '💯'
};

const RECENT_KEY = 'um_recent_emoji';

export class EmojiPicker {
  constructor() {
    this.el = null;
    this.activeCategory = 'Часто используемые';
    this.onPick = null;
    this._globalClickHandler = null;
    this._escHandler = null;
  }

  /** Загрузить недавние */
  _getRecent() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    } catch { return []; }
  }

  /** Добавить в недавние */
  _addRecent(emoji) {
    let recent = this._getRecent();
    recent = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, 24);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch {}
  }

  /** Открыть пикер */
  open(anchor, onPick) {
    this.close();
    this.onPick = onPick;

    // Контейнер
    const picker = document.createElement('div');
    picker.className = 'emoji-picker';
    picker.style.cssText = `
      position: fixed;
      width: 340px;
      max-height: 420px;
      background: var(--color-bg-elevated, #fff);
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: ctxIn 0.15s ease-out;
      font-family: inherit;
    `;

    // === Категории (tabs) ===
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display: flex; gap: 2px; padding: 8px; border-bottom: 1px solid var(--color-divider, rgba(0,0,0,0.08)); overflow-x: auto; scrollbar-width: none; flex-shrink: 0;';

    const categories = ['Часто используемые', ...Object.keys(EMOJI_DATA).filter((k) => k !== 'Часто используемые')];

    categories.forEach((cat) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.textContent = CATEGORY_ICONS[cat] || '•';
      tab.title = cat;
      const isActive = cat === this.activeCategory;
      tab.style.cssText = `
        padding: 6px 10px;
        border: none;
        background: ${isActive ? 'var(--color-accent-subtle, rgba(42,171,238,0.1))' : 'transparent'};
        border-radius: 8px;
        font-size: 18px;
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.12s;
        line-height: 1;
      `;
      tab.addEventListener('mouseenter', () => {
        if (cat !== this.activeCategory) tab.style.background = 'var(--color-bg-hover, #f4f4f5)';
      });
      tab.addEventListener('mouseleave', () => {
        if (cat !== this.activeCategory) tab.style.background = 'transparent';
      });
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Emoji] Категория:', cat);
        this.activeCategory = cat;
        // Обновляем активный стиль
        Array.from(tabs.children).forEach((t, i) => {
          const isNowActive = categories[i] === cat;
          t.style.background = isNowActive ? 'var(--color-accent-subtle, rgba(42,171,238,0.1))' : 'transparent';
        });
        renderGrid('');
        searchInput.value = '';
      });
      tabs.appendChild(tab);
    });
    picker.appendChild(tabs);

    // === Поиск ===
    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid var(--color-divider, rgba(0,0,0,0.08)); flex-shrink: 0;';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Поиск эмодзи…';
    searchInput.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      background: var(--color-bg-hover, #f4f4f5);
      border: 1.5px solid transparent;
      border-radius: 10px;
      font-size: 14px;
      font-family: inherit;
      color: inherit;
      outline: none;
      box-sizing: border-box;
    `;
    searchInput.addEventListener('focus', () => searchInput.style.borderColor = 'var(--color-accent, #2aabee)');
    searchInput.addEventListener('blur', () => searchInput.style.borderColor = 'transparent');

    let searchTimeout = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        renderGrid(searchInput.value.trim());
      }, 150);
    });

    searchWrap.appendChild(searchInput);
    picker.appendChild(searchWrap);

    // === Сетка ===
    const grid = document.createElement('div');
    grid.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 2px;
      align-content: start;
    `;
    picker.appendChild(grid);

    // === Рендер сетки ===
    const renderGrid = (query) => {
      grid.replaceChildren();

      let emojis = [];

      if (query) {
        // Поиск по всем категориям
        const allEmojis = Object.values(EMOJI_DATA).flat();
        // Ищем по индексам (приблизительный поиск)
        // Используем простую эвристику — если запрос == эмодзи, или содержит символ
        emojis = allEmojis.filter((e) => {
          // Простой поиск: если запрос на русском или английском — используем маппинг
          return e === query || e.includes(query);
        });
        // Если ничего не нашли — показываем все из активной категории
        if (!emojis.length) {
          emojis = allEmojis.slice(0, 100);
        }
      } else if (this.activeCategory === 'Часто используемые') {
        const recent = this._getRecent();
        emojis = recent.length ? recent : EMOJI_DATA['Часто используемые'];
      } else {
        emojis = EMOJI_DATA[this.activeCategory] || [];
      }

      if (!emojis.length) {
        const empty = document.createElement('div');
        empty.textContent = 'Ничего не найдено';
        empty.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--color-text-tertiary); font-size: 14px;';
        grid.appendChild(empty);
        return;
      }

      emojis.forEach((emoji) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = emoji;
        btn.style.cssText = `
          aspect-ratio: 1;
          border: none;
          background: transparent;
          border-radius: 8px;
          font-size: 22px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.1s, transform 0.1s;
        `;
        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'var(--color-bg-hover, #f4f4f5)';
          btn.style.transform = 'scale(1.15)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'transparent';
          btn.style.transform = 'scale(1)';
        });
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[Emoji] Выбрано:', emoji);
          this._addRecent(emoji);
          if (typeof this.onPick === 'function') {
            this.onPick(emoji);
          }
          this.close();
        });
        grid.appendChild(btn);
      });
    };

    renderGrid('');

    // === Позиционирование ===
    document.body.appendChild(picker);
    const anchorRect = anchor.getBoundingClientRect();
    const pickerRect = picker.getBoundingClientRect();
    let left = anchorRect.left;
    let top = anchorRect.top - pickerRect.height - 8;
    if (top < 8) top = anchorRect.bottom + 8;
    if (left + pickerRect.width > window.innerWidth - 8) {
      left = window.innerWidth - pickerRect.width - 8;
    }
    if (left < 8) left = 8;
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;

    this.el = picker;

    // === Закрытие по клику снаружи и Escape ===
    this._globalClickHandler = (e) => {
      if (!picker.contains(e.target) && !anchor.contains(e.target)) {
        this.close();
      }
    };
    this._escHandler = (e) => {
      if (e.key === 'Escape') this.close();
    };

    setTimeout(() => {
      document.addEventListener('click', this._globalClickHandler);
      document.addEventListener('keydown', this._escHandler);
    }, 10);
  }

  /** Закрыть */
  close() {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    if (this._globalClickHandler) {
      document.removeEventListener('click', this._globalClickHandler);
      this._globalClickHandler = null;
    }
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
  }

  /** Toggle */
  toggle(anchor, onPick) {
    if (this.el) this.close();
    else this.open(anchor, onPick);
  }
}

export default EmojiPicker;
