/**
 * Настройки: темы, акцент, размер шрифта, экспорт/импорт, язык.
 * Хранятся в localStorage + IndexedDB.
 */
import { el, clear } from '../../core/Utils.js';
import { modal } from '../../ui/Modal.js';
import { toast } from '../../ui/Toast.js';
import { icon } from '../../core/Icon.js';
import { store } from '../../core/Store.js';
import { bus } from '../../core/EventBus.js';
import { DB } from '../../data/DB.js';

const ACCENTS = ['blue','green','purple','pink','orange','red','teal','yellow','indigo','cyan','lime','rose'];

export class Settings {
  constructor() {
    this.settings = this._load();
    this._applyAll();
  }

  _load() {
    return JSON.parse(localStorage.getItem('ultra_settings') || '{}');
  }

  _save() {
    localStorage.setItem('ultra_settings', JSON.stringify(this.settings));
  }

  _applyAll() {
    const { theme = 'auto', accent = 'blue', fontSize = 'm', bubbleStyle = 'classic' } = this.settings;
    let effectiveTheme = theme;
    if (theme === 'auto') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.dataset.accent = accent;
    document.documentElement.dataset.fontSize = fontSize;
    document.documentElement.dataset.bubbleStyle = bubbleStyle;
    bus.emit('settings:changed', this.settings);
  }

  set(key, value) {
    this.settings[key] = value;
    this._save();
    this._applyAll();
  }

  open() {
    const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } });

    // Тема
    body.append(this._section('Тема', this._themeSelector()));

    // Акцент
    body.append(this._section('Акцентный цвет', this._accentSelector()));

    // Размер шрифта
    body.append(this._section('Размер шрифта', this._fontSizeSelector()));

    // Стиль пузырей
    body.append(this._section('Стиль пузырей', this._bubbleSelector()));

    // Экспорт / Импорт
    const dataSection = el('div', { style: { display: 'flex', gap: '8px' } });
    dataSection.append(
      el('button', { class: 'btn btn--ghost', onClick: () => this._exportData() }, icon('download', 16), 'Экспорт'),
      el('button', { class: 'btn btn--ghost', onClick: () => this._importData() }, icon('undo', 16), 'Импорт'),
      el('button', { class: 'btn btn--danger', onClick: () => this._reset() }, icon('trash', 16), 'Сброс')
    );
    body.append(this._section('Данные', dataSection));

    // О приложении
    body.append(el('div', {
      style: { textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '12px', paddingTop: '12px' },
      text: 'Ultra Messenger v3.0 — offline-first PWA'
    }));

    modal({ title: 'Настройки', body, width: '520px' });
  }

  _section(title, content) {
    return el('div', {},
      el('div', { style: { fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--color-text-secondary)' }, text: title }),
      content
    );
  }

  _themeSelector() {
    const themes = [
      { key: 'light', label: 'Светлая', icon: 'sun' },
      { key: 'dark', label: 'Тёмная', icon: 'moon' },
      { key: 'amoled', label: 'AMOLED', icon: 'monitor' },
      { key: 'auto', label: 'Авто', icon: 'globe' }
    ];
    const current = this.settings.theme || 'auto';
    const row = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' } });
    themes.forEach((t) => {
      const btn = el('button', {
        class: 'btn btn--ghost',
        style: {
          flexDirection: 'column',
          padding: '12px 8px',
          gap: '4px',
          border: current === t.key ? '2px solid var(--color-accent)' : '2px solid transparent'
        },
        onClick: () => { this.set('theme', t.key); btn.parentElement.querySelectorAll('.btn').forEach((b) => b.style.border = '2px solid transparent'); btn.style.border = '2px solid var(--color-accent)'; }
      }, icon(t.icon, 20), el('span', { text: t.label, style: { fontSize: '12px' } }));
      row.append(btn);
    });
    return row;
  }

  _accentSelector() {
    const current = this.settings.accent || 'blue';
    const row = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' } });
    ACCENTS.forEach((a) => {
      const btn = el('button', {
        'aria-label': a,
        style: {
          aspectRatio: '1',
          borderRadius: '50%',
          background: `var(--color-accent)`,
          border: current === a ? '3px solid var(--color-text-primary)' : '3px solid transparent',
          transition: 'transform 0.15s'
        },
        dataset: { accent: a },
        onClick: () => {
          this.set('accent', a);
          row.querySelectorAll('button').forEach((b) => b.style.border = '3px solid transparent');
          btn.style.border = '3px solid var(--color-text-primary)';
        }
      });
      // Устанавливаем цвет акцента через inline
      const accentColors = { blue: '#2aabee', green: '#4dcd5e', purple: '#8b5cf6', pink: '#ec4899', orange: '#f97316', red: '#ef4444', teal: '#14b8a6', yellow: '#eab308', indigo: '#6366f1', cyan: '#06b6d4', lime: '#84cc16', rose: '#f43f5e' };
      btn.style.background = accentColors[a];
      row.append(btn);
    });
    return row;
  }

  _fontSizeSelector() {
    const sizes = [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']];
    const current = this.settings.fontSize || 'm';
    const row = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' } });
    sizes.forEach(([key, label]) => {
      const btn = el('button', {
        class: 'btn btn--ghost',
        style: { border: current === key ? '2px solid var(--color-accent)' : '2px solid transparent' },
        text: label,
        onClick: () => {
          this.set('fontSize', key);
          row.querySelectorAll('.btn').forEach((b) => b.style.border = '2px solid transparent');
          btn.style.border = '2px solid var(--color-accent)';
        }
      });
      row.append(btn);
    });
    return row;
  }

  _bubbleSelector() {
    const styles = [['classic', 'Классика'], ['square', 'Квадратные'], ['rounded', 'Скруглённые'], ['minimal', 'Минимал']];
    const current = this.settings.bubbleStyle || 'classic';
    const row = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' } });
    styles.forEach(([key, label]) => {
      const btn = el('button', {
        class: 'btn btn--ghost',
        style: { fontSize: '12px', border: current === key ? '2px solid var(--color-accent)' : '2px solid transparent' },
        text: label,
        onClick: () => {
          this.set('bubbleStyle', key);
          row.querySelectorAll('.btn').forEach((b) => b.style.border = '2px solid transparent');
          btn.style.border = '2px solid var(--color-accent)';
        }
      });
      row.append(btn);
    });
    return row;
  }

  async _exportData() {
    const snapshot = {
      version: 3,
      exportedAt: Date.now(),
      user: store.state.user,
      chats: store.state.chats,
      messages: store.state.messages,
      settings: this.settings
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `ultra-msg-backup-${Date.now()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Экспорт завершён');
  }

  _importData() {
    const input = el('input', { type: 'file', accept: 'application/json', hidden: true });
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.chats || !data.messages) throw new Error('Неверный формат');
        store.state.chats = data.chats;
        store.state.messages = data.messages;
        if (data.settings) { this.settings = data.settings; this._save(); this._applyAll(); }
        bus.emit('chats:update');
        bus.emit('messages:render');
        toast.success('Импорт завершён');
      } catch (e) {
        toast.error('Ошибка импорта: ' + e.message);
      }
    });
    input.click();
  }

  async _reset() {
    const { confirmDialog } = await import('../../ui/Modal.js');
    const ok = await confirmDialog({ title: 'Сбросить всё?', message: 'Все данные будут удалены. Это действие необратимо.', danger: true, confirmText: 'Сбросить' });
    if (!ok) return;
    await DB.clear('messages');
    await DB.clear('chats');
    await DB.clear('users');
    await DB.clear('meta');
    localStorage.clear();
    location.reload();
  }
}
