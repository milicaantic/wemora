import { createStore } from "./store"

const store = createStore<string[]>("recepti.favorites", [])

export function useFavorites() {
  const ids = store.useValue()
  return {
    ids,
    isFavorite: (id: string) => ids.includes(id),
    toggle: (id: string) => {
      const current = store.read()
      store.write(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
    },
  }
}
