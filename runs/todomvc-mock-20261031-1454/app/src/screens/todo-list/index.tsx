import { useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native"

type Todo = { id: number; title: string; completed: boolean }
type Filter = "all" | "active" | "completed"

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const left = todos.filter((t) => !t.completed).length
  const completed = todos.length - left
  const allDone = todos.length > 0 && left === 0
  const shown = todos.filter((t) => (filter === "active" ? !t.completed : filter === "completed" ? t.completed : true))

  function add() {
    const value = title.trim()
    if (value === "") return
    setTodos([...todos, { id: Date.now(), title: value, completed: false }])
    setTitle("")
  }
  const toggle = (id: number) => setTodos(todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)))
  const toggleAll = () => setTodos(todos.map((t) => ({ ...t, completed: !allDone })))

  return (
    <View style={styles.page}>
      <Text role="heading" style={styles.title}>todos</Text>
      <TextInput
        accessibilityLabel="New Todo Input"
        placeholder="What needs to be done?"
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={add}
        style={styles.input}
      />
      {todos.length > 0 && (
        <Pressable role="checkbox" aria-checked={allDone} accessibilityLabel="❯ Toggle All Input" onPress={toggleAll} style={styles.row}>
          <Text>{allDone ? "☑" : "☐"} Mark all as complete</Text>
        </Pressable>
      )}
      <FlatList
        role="list"
        data={shown}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => (
          <View role="listitem" style={styles.row}>
            <Pressable role="checkbox" aria-checked={item.completed} onPress={() => toggle(item.id)}>
              <Text>{item.completed ? "☑" : "☐"}</Text>
            </Pressable>
            <Text style={[styles.grow, item.completed && styles.done]}>{item.title}</Text>
          </View>
        )}
      />
      {todos.length > 0 && (
        <View style={styles.footer}>
          <Text>{left} {left === 1 ? "item" : "items"} left!</Text>
          <View role="list" style={styles.row}>
            {(["all", "active", "completed"] as const).map((f) => (
              <View role="listitem" key={f}>
                <Pressable role="link" onPress={() => setFilter(f)}>
                  <Text style={filter === f ? styles.selected : undefined}>{f === "all" ? "All" : f === "active" ? "Active" : "Completed"}</Text>
                </Pressable>
              </View>
            ))}
          </View>
          {completed > 0 && (
            <Pressable role="button" onPress={() => setTodos(todos.filter((t) => !t.completed))}>
              <Text>Clear completed</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 48, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 12, fontSize: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  grow: { flex: 1 },
  done: { textDecorationLine: "line-through", color: "#999" },
  footer: { gap: 8 },
  selected: { fontWeight: "bold" },
})
