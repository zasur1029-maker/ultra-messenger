/**
 * Onboarding-тур: 4 шага с подсветкой элементов.
 */
import { el, sleep } from '../../core/Utils.js';
import { icon } from '../../core/Icon.js';

const STEPS = [
  { target: '.search', title: 'Поиск', text: 'Найдите чат, сообщение или пользователя' },
  { target: '.filters', title: 'Фильтры', text: 'Переключайтесь между типами чатов' },
  { target: '.composer', title: 'Поле ввода', text: 'Enter — отправить, Shift+Enter — новая строка' },
  { target: '.fab', title: 'Новый чат', text: 'Создайте новый диалог или группу' }
];

export const Onboarding = {
  async run() {
    const overlay = document.getElementById('onboarding');
    overlay.hidden = false;

    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i];
      await this.showStep(overlay, step, i);
    }

    overlay.hidden = true;
    overlay.replaceChildren();
  },

  showStep(overlay, step, index) {
    return new Promise((resolve) => {
      const target = document.querySelector(step.target);
      overlay.replaceChildren();

      if (target) {
        const rect = target.getBoundingClientRect();
        const padding = 8;
        const highlight = el('div', {
          class: 'onboarding__highlight',
          style: {
            position: 'fixed',
            left: `${rect.left - padding}px`,
            top: `${rect.top - padding}px`,
            width: `${rect.width + padding * 2}px`,
            height: `${rect.height + padding * 2}px`,
            border: '3px solid var(--color-accent)',
            borderRadius: '12px',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            pointerEvents: 'none',
            zIndex: '1',
            transition: 'all 0.3s ease'
          }
        });
        overlay.append(highlight);
      }

      const tip = el('div', {
        class: 'onboarding__tip',
        style: {
          position: 'fixed',
          zIndex: '2',
          maxWidth: '300px',
          background: 'var(--color-bg-elevated)',
          padding: '20px',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-2xl)'
        }
      },
        el('h3', { text: step.title, style: { marginBottom: '8px', fontSize: '1.1rem' } }),
        el('p', { text: step.text, style: { color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '16px' } }),
        el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
          el('button', { class: 'btn btn--ghost btn--sm', text: 'Пропустить', onClick: () => { overlay.hidden = true; overlay.replaceChildren(); resolve('skip'); } }),
          el('button', { class: 'btn btn--primary btn--sm', text: index === STEPS.length - 1 ? 'Готово' : 'Далее', onClick: () => resolve() })
        )
      );

      if (target) {
        const rect = target.getBoundingClientRect();
        const tipRect = { w: 300, h: 180 };
        let left = rect.left;
        let top = rect.bottom + 12;
        if (top + tipRect.h > window.innerHeight) top = rect.top - tipRect.h - 12;
        left = Math.max(12, Math.min(left, window.innerWidth - tipRect.w - 12));
        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
      } else {
        tip.style.left = '50%';
        tip.style.top = '50%';
        tip.style.transform = 'translate(-50%, -50%)';
      }

      overlay.append(tip);
    });
  }
};
