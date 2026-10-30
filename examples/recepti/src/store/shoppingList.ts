import { createLocalStore } from "./localStore"

export type ShoppingItem = { id: string; name: string; bought: boolean }

const store = createLocalStore<ShoppingItem[]>("recepti.shopping", [])

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Adds names that are not on the list yet, ignoring case and empty names. */
function addNames(names: string[]): void {
  const items = [...store.read()]
  for (const raw of names) {
    const name = raw.trim()
    if (name === "" || items.some((item) => sameName(item.name, name))) continue
    items.push({ id: crypto.randomUUID(), name, bought: false })
  }
  store.write(items)
}

export function useShoppingList() {
  const items = store.useValue()
  return {
    items,
    add: (name: string) => addNames([name]),
    addMany: (names: string[]) => addNames(names),
    toggle: (id: string) =>
      store.write(store.read().map((item) => (item.id === id ? { ...item, bought: !item.bought } : item))),
    clearBought: () => store.write(store.read().filter((item) => !item.bought)),
  }
}
