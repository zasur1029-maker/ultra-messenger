/**
 * Modal v2 — переписан с нуля.
 * Гарантированная работа кнопок внутри модалки.
 */

const ROOT_ID = 'modalRoot';

/**
 * Открыть модалку.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {Node|Function|string} opts.body
 * @param {Node[]} opts.footer
 * @param {Function} opts.onClose
 * @param {boolean} opts.closable
 * @param {string} opts.width
 */
export function modal(opts = {}) {
  const {
    title = '',
    body,
    footer = null,
    onClose = null,
    closable = true,
    width = '480px'
  } = opts;

  const root = document.getElementById(ROOT_ID) || (() => {
    const r = document.createElement('div');
    r.id = ROOT_ID;
    document.body.appendChild(r);
    return r;
  })();

  // --- Overlay ---
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.55);
    z-index: 999999;
    overflow-y: auto;
    pointer-events: auto;
    animation: fadeIn 0.15s ease-out;
  `;

  // --- Box ---
  const box = document.createElement('div');
  box.className = 'modal__box';
  box.style.cssText = `
    width: 100%;
    max-width: ${width};
    background: var(--color-bg-elevated, #fff);
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    max-height: calc(100vh - 32px);
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1000000;
    pointer-events: auto;
    animation: modalIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;

  // --- Header ---
  if (title || closable) {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--color-divider, rgba(0,0,0,0.08));
      flex-shrink: 0;
    `;

    if (title) {
      const h = document.createElement('h2');
      h.textContent = title;
      h.style.cssText = 'font-size: 17px; font-weight: 600; margin: 0;';
      header.appendChild(h);
    } else {
      header.appendChild(document.createElement('span'));
    }

    if (closable) {
      const closeBtn = document.createElement('button');
      closeBtn.setAttribute('aria-label', 'Закрыть');
      closeBtn.type = 'button';
      closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      closeBtn.style.cssText = `
        width: 36px; height: 36px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: var(--color-text-secondary, #707579);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        z-index: 1;
        transition: background 0.15s;
      `;
      closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = 'var(--color-bg-hover, #f4f4f5)');
      closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'transparent');
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
      });
      header.appendChild(closeBtn);
    }

    box.appendChild(header);
  }

  // --- Body ---
  const bodyEl = document.createElement('div');
  bodyEl.style.cssText = `
    padding: 20px;
    overflow-y: auto;
    position: relative;
    z-index: 1;
    pointer-events: auto;
  `;

  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.appendChild(body);
  else if (typeof body === 'function') {
    const result = body();
    if (result instanceof Node) bodyEl.appendChild(result);
  }
  box.appendChild(bodyEl);

  // --- Footer ---
  if (footer && footer.length) {
    const footerEl = document.createElement('div');
    footerEl.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 12px 20px;
      border-top: 1px solid var(--color-divider, rgba(0,0,0,0.08));
      flex-shrink: 0;
      position: relative;
      z-index: 1;
      pointer-events: auto;
    `;
    footer.forEach((f) => {
      if (f instanceof Node) footerEl.appendChild(f);
    });
    box.appendChild(footerEl);
  }

  // --- Click on overlay closes ---
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && closable) close();
  });

  // --- Escape closes ---
  const onEsc = (e) => { if (e.key === 'Escape' && closable) close(); };
  document.addEventListener('keydown', onEsc);

  // --- Mount ---
  overlay.appendChild(box);
  root.appendChild(overlay);

  // --- Focus first focusable ---
  setTimeout(() => {
    const first = box.querySelector('button, input, textarea, [tabindex]');
    first?.focus?.();
  }, 50);

  // --- Close function ---
  function close() {
    document.removeEventListener('keydown', onEsc);
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.15s';
    setTimeout(() => overlay.remove(), 150);
    onClose?.();
  }

  return { close, box, body: bodyEl, overlay };
}

/**
 * Confirm dialog (замена window.confirm).
 */
export function confirmDialog({ title, message, confirmText = 'OK', cancelText = 'Отмена', danger = false } = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (val) => {
      if (resolved) return;
      resolved = true;
      resolve(val);
    };

    const body = document.createElement('p');
    body.textContent = message || '';
    body.style.cssText = 'margin: 0; color: var(--color-text-secondary, #707579); line-height: 1.5;';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = cancelText;
    cancelBtn.style.cssText = `
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--color-text-secondary, #707579);
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      position: relative;
      z-index: 1;
      transition: background 0.15s;
    `;
    cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = 'var(--color-bg-hover, #f4f4f5)');
    cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = 'transparent');

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.textContent = confirmText;
    okBtn.style.cssText = `
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      background: ${danger ? 'var(--color-danger, #e53935)' : 'var(--color-accent, #2aabee)'};
      color: #fff;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      position: relative;
      z-index: 1;
      transition: filter 0.15s;
    `;
    okBtn.addEventListener('mouseenter', () => okBtn.style.filter = 'brightness(0.92)');
    okBtn.addEventListener('mouseleave', () => okBtn.style.filter = 'none');

    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      m.close();
      finish(false);
    });
    okBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      m.close();
      finish(true);
    });

    const m = modal({
      title,
      body,
      footer: [cancelBtn, okBtn],
      onClose: () => finish(false)
    });
  });
}

/**
 * Input dialog (замена window.prompt).
 */
export function inputDialog({ title, placeholder = '', value = '', multiline = false, onValidate = null, confirmText = 'OK' } = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (val) => {
      if (resolved) return;
      resolved = true;
      resolve(val);
    };

    const wrap = document.createElement('div');
    const input = document.createElement(multiline ? 'textarea' : 'input');
    if (!multiline) input.type = 'text';
    else input.rows = 4;
    input.placeholder = placeholder;
    input.value = value;
    input.style.cssText = `
      width: 100%;
      padding: 12px 16px;
      background: var(--color-bg-hover, #f4f4f5);
      border: 1.5px solid transparent;
      border-radius: 12px;
      font-size: 15px;
      font-family: inherit;
      color: inherit;
      outline: none;
      resize: ${multiline ? 'vertical' : 'none'};
      position: relative;
      z-index: 1;
    `;
    input.addEventListener('focus', () => input.style.borderColor = 'var(--color-accent, #2aabee)');
    input.addEventListener('blur', () => input.style.borderColor = 'transparent');

    const err = document.createElement('span');
    err.style.cssText = 'display: block; color: var(--color-danger, #e53935); font-size: 12px; min-height: 1em; margin-top: 4px;';

    wrap.appendChild(input);
    wrap.appendChild(err);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: transparent; color: var(--color-text-secondary); font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; position: relative; z-index: 1;';
    cancelBtn.addEventListener('click', (e) => { e.preventDefault(); m.close(); finish(null); });

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.textContent = confirmText;
    okBtn.style.cssText = 'padding: 10px 20px; border: none; border-radius: 8px; background: var(--color-accent, #2aabee); color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; position: relative; z-index: 1;';
    okBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      const validationError = onValidate ? onValidate(v) : null;
      if (validationError) {
        err.textContent = validationError;
        input.style.borderColor = 'var(--color-danger, #e53935)';
        return;
      }
      m.close();
      finish(v);
    });

    if (!multiline) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          okBtn.click();
        }
      });
    }

    const m = modal({
      title,
      body: wrap,
      footer: [cancelBtn, okBtn],
      onClose: () => finish(null)
    });

    setTimeout(() => input.focus(), 100);
  });
}

export default { modal, confirmDialog, inputDialog };
