/**
 * Простой LRU-кэш с лимитом по количеству.
 * Используется для аватаров, рендеров, результатов поиска.
 */
export class LRUCache {
  #map = new Map();
  #limit;

  constructor(limit = 200) {
    this.#limit = limit;
  }

  get(key) {
    if (!this.#map.has(key)) return undefined;
    const value = this.#map.get(key);
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.#map.has(key)) this.#map.delete(key);
    this.#map.set(key, value);
    if (this.#map.size > this.#limit) {
      const firstKey = this.#map.keys().next().value;
      this.#map.delete(firstKey);
    }
    return this;
  }

  has(key) { return this.#map.has(key); }
  delete(key) { return this.#map.delete(key); }
  clear() { this.#map.clear(); }
  get size() { return this.#map.size; }
}

export const cache = {
  avatars: new LRUCache(500),
  rendered: new LRUCache(300),
  search: new LRUCache(50)
};
