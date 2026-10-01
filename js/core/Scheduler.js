cat > js/core/Scheduler.js << 'EOF'
/**
 * Scheduler — обёртка над requestIdleCallback / requestAnimationFrame.
 * Позволяет откладывать тяжёлые задачи на потом, не блокируя UI.
 */

const hasIdle = typeof requestIdleCallback === 'function';

/** Задача, отложенная до idle (или setTimeout-фолбэк) */
export function onIdle(fn, options = {}) {
  if (hasIdle) return requestIdleCallback(fn, { timeout: 2000, ...options });
  return setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 16 }), 1);
}

/** Отмена idle-задачи */
export function cancelIdle(handle) {
  if (hasIdle && typeof cancelIdleCallback === 'function') cancelIdleCallback(handle);
  else clearTimeout(handle);
}

/** Отложить на следующий кадр */
export function nextFrame(fn) {
  return requestAnimationFrame(fn);
}

/** Отложить до следующего "тика" (microtask-safe) */
export function nextTick(fn) {
  return queueMicrotask(fn);
}

/** Батчинг задач: собирает вызовы в один rAF-тик */
export function createBatcher(fn) {
  let scheduled = false;
  let args = [];
  return function (...a) {
    args = a;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn.apply(this, args);
    });
  };
}

/** Асинхронный sleep с возможностью отмены */
export function delay(ms, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

export default { onIdle, cancelIdle, nextFrame, nextTick, createBatcher, delay };
EOF
echo "✅ js/core/Scheduler.js создан"
