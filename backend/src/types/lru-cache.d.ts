declare module "lru-cache" {
  interface DisposeFunction<K, V> {
    (value: V, key: K): void;
  }

  class LRUCache<K, V> {
    max: number;
    length: number;
    constructor(options?: {
      max?: number;
      maxAge?: number;
      ttl?: number;
      stale?: boolean;
      updateAgeOnGet?: boolean;
      dispose?: DisposeFunction<K, V>;
      noDisposeOnSet?: boolean;
    });
    get(key: K): V | undefined;
    set(key: K, value: V): this;
    has(key: K): boolean;
    del(key: K): boolean;
    delete(key: K): boolean;
    reset(): void;
    clear(): void;
    keys(): IterableIterator<K>;
    values(): IterableIterator<V>;
    forEach(callback: (value: V, key: K, cache: LRUCache<K, V>) => void, thisArg?: any): void;
    prune(): boolean;
    pop(): V | undefined;
    dump(): Array<[K, V]>;
    load(data: Array<[K, V]>): void;
  }

  export default LRUCache;
}
