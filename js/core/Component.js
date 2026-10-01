/**
 * Базовый класс UI-компонента.
 * Жизненный цикл: mount → update → unmount.
 */
export class Component {
  constructor(props = {}) {
    this.props = props;
    this.el = null;
    this._subs = [];
    this._mounted = false;
  }

  /** Подписка с автоотпиской */
  sub(event, fn) {
    const { bus } = window.__BUS__ || {};
    if (bus) this._subs.push(bus.on(event, fn));
    return fn;
  }

  mount(parent) {
    this.el = this.render();
    if (parent) parent.append(this.el);
    this._mounted = true;
    this.onMount?.();
    return this.el;
  }

  update() {
    if (!this._mounted || !this.el) return;
    const newEl = this.render();
    this.el.replaceWith(newEl);
    this.el = newEl;
    this.onUpdate?.();
  }

  unmount() {
    this._subs.forEach((unsub) => unsub());
    this._subs = [];
    this.el?.remove();
    this._mounted = false;
    this.onUnmount?.();
  }

  render() { throw new Error('render() must be implemented'); }
}
