/**
 * EventBus — простая Pub/Sub шина.
 * Поддерживает namespace'ы, once, wildcard ('chat:*').
 */
export class EventBus {
  #listeners = new Map();

  /** Подписка на событие */
  on(event, fn) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  /** Однократная подписка */
  once(event, fn) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      fn(...args);
    };
    return this.on(event, wrapper);
  }

  /** Отписка */
  off(event, fn) {
    this.#listeners.get(event)?.delete(fn);
  }

  /** Отправка события */
  emit(event, payload) {
    // Точные слушатели
    this.#listeners.get(event)?.forEach((fn) => {
      try { fn(payload); } catch (e) { console.error(`[Bus] ${event}:`, e); }
    });
    // Wildcard
    const [ns] = event.split(':');
    this.#listeners.get(`${ns}:*`)?.forEach((fn) => {
      try { fn({ type: event, payload }); } catch (e) { console.error(`[Bus] ${event}:`, e); }
    });
    // Global wildcard
    this.#listeners.get('*')?.forEach((fn) => {
      try { fn({ type: event, payload }); } catch (e) { console.error(e); }
    });
  }

  /** Удалить все слушатели */
  clear() { this.#listeners.clear(); }
}

export const bus = new EventBus();
