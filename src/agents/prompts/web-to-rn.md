# Web → React Native mapping

Use this table for every element. Imports: `View`, `Text`, `TextInput`, `Pressable`, `ScrollView`, `FlatList`, `Image`, `StyleSheet`, `ActivityIndicator`, `Switch` from `react-native`; `Link`, `useRouter`, `useLocalSearchParams` from `expo-router`; `AsyncStorage` from `@react-native-async-storage/async-storage` (only inside the shared `data` unit).

## Elements

| Web | React Native | Keep the same |
|---|---|---|
| `div`, `section`, `main`, `header`, `footer`, `nav`, `form`, `aside` | `View` | — |
| `span`, `p`, `strong`, `em`, `label` (as text) | `Text` | the text |
| `h1`–`h6` | `<Text role="heading">` | the text |
| `button` | `<Pressable role="button" onPress={…}><Text>…</Text></Pressable>` | the text; `aria-label` → `accessibilityLabel` |
| `button disabled` | `<Pressable role="button" disabled={…} aria-disabled={…}>` | the text |
| `input type="text"/"search"/"email"/"number"` | `<TextInput accessibilityLabel="…" value onChangeText />` | the label text, exactly |
| `input type="number"` | same, plus `keyboardType="numeric"`; convert with `Number(text)` | the label text |
| `input type="password"` | `TextInput` with `secureTextEntry` | the label text |
| `textarea` | `TextInput multiline` | the label text |
| `input type="checkbox"` | `<Pressable role="checkbox" aria-checked={checked} accessibilityLabel="…" onPress={toggle}>` | the label text |
| `select` / `option` | a row of `<Pressable role="button">` per option, or a list in a modal | the label and each option text |
| `form onSubmit` | the submit button calls the same function; `TextInput onSubmitEditing` too | — |
| `ul` / `ol` | `<View role="list">` | — |
| `li` | `<View role="listitem">` | the text |
| long list (`items.map` with many rows) | `FlatList` (wrap rows in `role="listitem"`) | — |
| `table` | a list of cards: one `View` per row, each cell as `<Text>label: value</Text>` or label above value | header texts and cell texts |
| `img` | `<Image source={{ uri }} style={{ width, height }} accessibilityLabel={alt} />` | the `alt` text |
| icon or emoji button | `Pressable role="button"` with `accessibilityLabel` = web `aria-label` or `title` | the name |
| loading text or spinner | `<Text>` with the same loading text (add `ActivityIndicator` if you want) | the text |
| page that scrolls | `ScrollView` (or `FlatList` for the list part) | — |
| `title` tooltip, hover styles, `:hover` | nothing (hover does not exist) | — |
| `className`, CSS file | `style={styles.x}` with `StyleSheet.create` | — |

Text must always be inside `<Text>`. A raw string directly inside `View` or `Pressable` crashes the app.

## Navigation (React Router → Expo Router)

| Web | Expo Router |
|---|---|
| `<Link to="/kategorije">Kategorije</Link>`, `<NavLink>` | `<Link href="/kategorije">Kategorije</Link>` |
| `<Link to={`/recepti/${id}`}>` | `<Link href={`/recepti/${id}`}>` |
| `const navigate = useNavigate(); navigate("/x")` | `const router = useRouter(); router.push("/x")` |
| `navigate(-1)` | `router.back()` |
| `const { id } = useParams()` | `const { id } = useLocalSearchParams<{ id: string }>()` |
| `useSearchParams()` (`?q=…`) | `useLocalSearchParams<{ q?: string }>()` and `router.setParams({ q })` |
| `<Navigate to="/x" />` | `<Redirect href="/x" />` from `expo-router` |
| `<Outlet />` in a layout | nothing in screens; the root layout (`app/_layout.tsx`) renders the screens |

Web paths with `:param` become mobile paths with `[param]` only in route files. In `href` and `router.push` you write the real address, e.g. `/recepti/sarma`.

## Data

API calls stay the same, only the address comes from config:

```ts
import { API_URL } from "@/shared/config"

export async function getRecipes(): Promise<Recipe[]> {
  const response = await fetch(`${API_URL}/api/recipes`)
  if (!response.ok) throw new Error(`GET /api/recipes failed with ${response.status}`)
  return (await response.json()) as Recipe[]
}
```

`useEffect` + `useState` for loading data work the same as on the web.

## `localStorage` → a store in `shared/data` with AsyncStorage

Only the shared unit `data` writes this. Same keys and the same data shape as the web. It keeps the value in memory for instant reads and saves it to AsyncStorage, so it survives a reload:

```ts
// shared/data/store.ts
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
```

Hooks built on the store (`useFavorites`, `useShoppingList`…) keep the web names and return the same things, so screens look like the web screens.

## Layout and the root layout

The shared unit `layout` turns the web layout (sidebar, header, menu) into a mobile one and may write `app/_layout.tsx`:

- Keep `Stack` from `expo-router` with `screenOptions={{ headerShown: false }}`, or the screens show route names as titles.
- A web sidebar or top menu becomes a bar at the bottom made of `Link`s with **the same texts** (`Recepti`, `Kategorije`, `Omiljeni`…). Use `Link`, not a tab navigator: tests look for links by name.
- Keep the web app title (e.g. `Recepti`) visible as `<Text role="heading">`.

```tsx
// app/_layout.tsx (only the layout unit)
import { Stack } from "expo-router"
import { View } from "react-native"
import { BottomBar } from "@/shared/layout"

export default function RootLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <BottomBar />
    </View>
  )
}
```

## A full example: web button and input → React Native

Web:

```tsx
<form onSubmit={onSubmit}>
  <label htmlFor="namirnica">Namirnica</label>
  <input id="namirnica" value={name} onChange={(e) => setName(e.target.value)} />
  <button type="submit">Dodaj</button>
</form>
```

React Native:

```tsx
<View style={styles.form}>
  <Text>Namirnica</Text>
  <TextInput
    accessibilityLabel="Namirnica"
    value={name}
    onChangeText={setName}
    onSubmitEditing={add}
    style={styles.input}
  />
  <Pressable role="button" onPress={add} style={styles.button}>
    <Text>Dodaj</Text>
  </Pressable>
</View>
```
