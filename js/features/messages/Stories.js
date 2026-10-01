/**
 * Stories — истории (сторис) в стиле Instagram.
 * Хранятся локально в localStorage.
 */
const KEY = 'um_stories';

export class Stories {
  /** Все истории */
  static all() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { return {}; }
  }

  /** Истории конкретного пользователя */
  static for(userId) {
    const all = this.all();
    return all[userId] || [];
  }

  /** Есть ли непросмотренные */
  static hasUnseen(userId, currentUserId) {
    const list = this.for(userId);
    return list.some((s) => !s.seenBy?.includes(currentUserId));
  }

  /** Добавить историю */
  static add(userId, { type, content, bgColor = '#2aabee', duration = 5000 }) {
    const all = this.all();
    if (!all[userId]) all[userId] = [];
    all[userId].push({
      id: 'story_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type,          // 'text' | 'image'
      content,       // текст или dataURL
      bgColor,
      duration,
      createdAt: Date.now(),
      seenBy: []
    });
    localStorage.setItem(KEY, JSON.stringify(all));
  }

  /** Пометить как просмотренную */
  static markSeen(userId, storyId, viewerId) {
    const all = this.all();
    if (!all[userId]) return;
    const story = all[userId].find((s) => s.id === storyId);
    if (story) {
      story.seenBy = story.seenBy || [];
      if (!story.seenBy.includes(viewerId)) story.seenBy.push(viewerId);
      localStorage.setItem(KEY, JSON.stringify(all));
    }
  }
}

/**
 * Открыть просмотр историй пользователя.
 */
export function openStoryViewer(userId, currentUserId, onClose) {
  const stories = Stories.for(userId);
  if (!stories.length) return;

  // Определяем с какой начать — первая непросмотренная
  let startIdx = stories.findIndex((s) => !s.seenBy?.includes(currentUserId));
  if (startIdx < 0) startIdx = 0;

  let currentIdx = startIdx;

  // Overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; inset: 0; background: #000; z-index: 9999999; display: flex; flex-direction: column;';

  // Полоса прогресса
  const progressBar = document.createElement('div');
  progressBar.style.cssText = 'position: absolute; top: 12px; left: 12px; right: 12px; display: flex; gap: 4px; z-index: 2;';
  stories.forEach(() => {
    const seg = document.createElement('div');
    seg.style.cssText = 'flex: 1; height: 3px; background: rgba(255,255,255,0.3); border-radius: 3px; overflow: hidden;';
    const fill = document.createElement('div');
    fill.style.cssText = 'height: 100%; width: 0%; background: #fff;';
    seg.appendChild(fill);
    progressBar.appendChild(seg);
  });
  overlay.appendChild(progressBar);

  // Контент
  const content = document.createElement('div');
  content.style.cssText = 'flex: 1; display: grid; place-items: center; position: relative; padding: 60px 40px;';
  overlay.appendChild(content);

  // Кнопки навигации
  const prevBtn = document.createElement('button');
  prevBtn.style.cssText = 'position: absolute; left: 20px; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 20px; cursor: pointer; z-index: 3;';
  prevBtn.textContent = '‹';
  overlay.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.style.cssText = 'position: absolute; right: 20px; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 20px; cursor: pointer; z-index: 3;';
  nextBtn.textContent = '›';
  overlay.appendChild(nextBtn);

  // Закрытие
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'position: absolute; top: 20px; right: 20px; width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 24px; cursor: pointer; z-index: 3;';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', close);
  overlay.appendChild(closeBtn);

  // Таймеры
  let timer = null;
  let progressTimer = null;

  function renderStory() {
    clearTimeout(timer);
    clearInterval(progressTimer);
    content.replaceChildren();

    const story = stories[currentIdx];
    if (!story) { close(); return; }

    // Помечаем как просмотренную
    Stories.markSeen(userId, story.id, currentUserId);

    // Обновляем прогресс
    progressBar.querySelectorAll('div > div').forEach((fill, i) => {
      fill.style.width = i < currentIdx ? '100%' : i === currentIdx ? '0%' : '0%';
    });

    // Контент
    if (story.type === 'text') {
      const textEl = document.createElement('div');
      textEl.textContent = story.content;
      textEl.style.cssText = `font-size: 42px; color: #fff; text-align: center; padding: 40px; background: ${story.bgColor}; border-radius: 20px; max-width: 80%; word-wrap: break-word; font-weight: 600; line-height: 1.3;`;
      content.appendChild(textEl);
    } else if (story.type === 'image') {
      const img = document.createElement('img');
      img.src = story.content;
      img.style.cssText = 'max-width: 100%; max-height: 80vh; border-radius: 12px; object-fit: contain;';
      content.appendChild(img);
    }

    // Полоса прогресса
    const currentFill = progressBar.children[currentIdx].querySelector('div');
    const duration = story.duration || 5000;
    const startTime = Date.now();
    progressTimer = setInterval(() => {
      const pct = Math.min(100, (Date.now() - startTime) / duration * 100);
      currentFill.style.width = pct + '%';
      if (pct >= 100) {
        clearInterval(progressTimer);
        next();
      }
    }, 50);
  }

  function next() {
    if (currentIdx < stories.length - 1) {
      currentIdx++;
      renderStory();
    } else {
      close();
    }
  }

  function prev() {
    if (currentIdx > 0) {
      currentIdx--;
      renderStory();
    }
  }

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  function close() {
    clearTimeout(timer);
    clearInterval(progressTimer);
    overlay.remove();
    onClose?.();
  }

  // Клик по фону — закрыть
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === content) close();
  });

  // Стрелки клавиатуры
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  };
  document.addEventListener('keydown', onKey);

  // Очистка при закрытии
  const origClose = close;
  close = () => {
    document.removeEventListener('keydown', onKey);
    origClose();
  };

  document.body.appendChild(overlay);
  renderStory();
}

export default { Stories, openStoryViewer };
