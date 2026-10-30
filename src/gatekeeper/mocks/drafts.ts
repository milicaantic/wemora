// Ručno napisani nacrti ekrana "shopping-list" (Recepti) za testove kapija 1–4.
// Kod je u stringovima jer glavni tsc ne poznaje React Native; test ih upisuje u privremeni nacrt.
// Svaki loš nacrt je dobar nacrt sa tačno jednom greškom, za tačno jednu kapiju.

export const SCREEN_FILE = "screens/shopping-list/index.tsx"

export const GOOD = `import { useState } from "react"
import { FlatList, Pressable, Text, TextInput, View } from "react-native"

type Item = { id: number; name: string; bought: boolean }

export default function ShoppingList() {
  const [items, setItems] = useState<Item[]>([])
  const [name, setName] = useState("")
  const bought = items.filter((i) => i.bought).length

  function add() {
    if (name.trim() === "") return
    setItems([...items, { id: Date.now(), name, bought: false }])
    setName("")
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text>Lista za kupovinu</Text>
      <TextInput accessibilityLabel="Namirnica" value={name} onChangeText={setName} />
      <Pressable role="button" onPress={add}>
        <Text>Dodaj</Text>
      </Pressable>
      {items.length === 0 ? (
        <Text>Lista za kupovinu je prazna</Text>
      ) : (
        <View>
          <FlatList
            data={items}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => <Text>{item.name}</Text>}
          />
          <Text>
            Kupljeno: {bought} od {items.length}
          </Text>
        </View>
      )}
    </View>
  )
}
`

/** Kapija 1: zagrada nije zatvorena. */
export const BAD_PARSE = GOOD.replace("if (name.trim() === \"\") return", "if (name.trim() === \"\" return")

/** Kapija 2: <div> i localStorage. */
export const BAD_FORBIDDEN = GOOD.replace(
  '<View style={{ padding: 16, gap: 12 }}>',
  '<View style={{ padding: 16, gap: 12 }}>\n      <div>{localStorage.getItem("x")}</div>',
)

/** Kapija 3: Item nema polje "title". */
export const BAD_TSC = GOOD.replace("<Text>{item.name}</Text>", "<Text>{item.title}</Text>")

/** Kapija 4: labela polja promenjena ("Namirnica" → "Unesi namirnicu"). */
export const BAD_LABEL = GOOD.replace('accessibilityLabel="Namirnica"', 'accessibilityLabel="Unesi namirnicu"')

/** Kapija 4: dugme bez role="button" (D-005). */
export const BAD_ROLE = GOOD.replace('<Pressable role="button" onPress={add}>', "<Pressable onPress={add}>")

/** Kapija 4: tekst praznog stanja promenjen. */
export const BAD_TEXT = GOOD.replace("<Text>Lista za kupovinu je prazna</Text>", "<Text>Nema ničega</Text>")
