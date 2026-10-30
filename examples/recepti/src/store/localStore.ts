import { useSyncExternalStore } from "react"

/**
 * A value kept in localStorage that every component sees at once.
 * Other tabs are picked up through the `storage` event.
 */
export function createLocalStore<T>(key: string, initial: T) {
  const listeners = new Set<() => void>()
  let cachedRaw: string | null | undefined
  let cachedValue: T = initial

  function read(): T {
    const raw = window.localStorage.getItem(key)
    if (raw !== cachedRaw) {
      cachedRaw = raw
      try {
        cachedValue = raw === null ? initial : (JSON.parse(raw) as T)
      } catch {
        cachedValue = initial
      }
    }
    return cachedValue
  }

  function write(next: T): void {
    window.localStorage.setItem(key, JSON.stringify(next))
    listeners.forEach((listener) => listener())
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) listener()
    }
    window.addEventListener("storage", onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener("storage", onStorage)
    }
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, read, () => initial)
  }

  return { read, write, useValue }
}
