import AsyncStorage from "@react-native-async-storage/async-storage"
import { useSyncExternalStore } from "react"

export function createStore<T>(key: string, initial: T) {
  const listeners = new Set<() => void>()
  let value = initial
  let written = false
  const emit = () => listeners.forEach((l) => l())

  // load the saved value once, at start (unless something was written meanwhile)
  void AsyncStorage.getItem(key).then((raw) => {
    if (raw === null || written) return
    try {
      value = JSON.parse(raw) as T
      emit()
    } catch {
      // keep the initial value
    }
  })

  return {
    read: () => value,
    write(next: T) {
      written = true
      value = next
      emit()
      void AsyncStorage.setItem(key, JSON.stringify(next))
    },
    useValue: () =>
      useSyncExternalStore(
        (l) => {
          listeners.add(l)
          return () => listeners.delete(l)
        },
        () => value,
        () => value,
      ),
  }
}
