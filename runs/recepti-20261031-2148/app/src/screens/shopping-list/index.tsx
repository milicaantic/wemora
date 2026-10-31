import { useState } from "react"
import { View, TextInput, Pressable, ScrollView, StyleSheet } from "react-native"
import { useShoppingList } from "@/shared/data"
import { Text, colors, fontSizes } from "@/shared/theme"

export default function ShoppingListScreen() {
  const { items, add, toggle, clearBought } = useShoppingList()
  const [name, setName] = useState("")
  const boughtCount = items.filter((item) => item.bought).length

  function onSubmit() {
    if (name.trim() === "") return
    add(name)
    setName("")
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text role="heading" style={styles.pageTitle}>
          Lista za kupovinu
        </Text>

        <View style={styles.form}>
          <Text>Namirnica</Text>
          <TextInput
            accessibilityLabel="Namirnica"
            value={name}
            onChangeText={setName}
            onSubmitEditing={onSubmit}
            style={styles.input}
          />
          <Pressable role="button" onPress={onSubmit} style={styles.button}>
            <Text style={styles.buttonText}>Dodaj</Text>
          </Pressable>
        </View>

        {items.length === 0 ? (
          <Text style={styles.emptyState}>Lista za kupovinu je prazna</Text>
        ) : (
          <View>
            <View style={styles.list} role="list">
              {items.map((item) => (
                <View key={item.id} style={styles.listItem} role="listitem">
                  <Pressable
                    role="checkbox"
                    aria-checked={item.bought}
                    onPress={() => toggle(item.id)}
                    style={styles.checkbox}
                  >
                    <Text style={styles.checkboxText}>
                      {item.bought ? "☑" : "☐"}
                    </Text>
                  </Pressable>
                  <Text
                    style={[
                      styles.itemName,
                      item.bought && styles.itemNameBought,
                    ]}
                  >
                    {item.name}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.footer}>
              <Text>
                Kupljeno: {boughtCount} od {items.length}
              </Text>
              <Pressable
                role="button"
                onPress={clearBought}
                disabled={boughtCount === 0}
                aria-disabled={boughtCount === 0}
                style={[
                  styles.button,
                  boughtCount === 0 && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.buttonText}>Obriši kupljene</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  pageTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: 32,
    marginBottom: 20,
    fontWeight: "600",
  },
  form: {
    gap: 12,
    marginBottom: 20,
  },
  input: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    borderRadius: 4,
    backgroundColor: colors.button,
    color: colors.text,
    fontSize: fontSizes.body,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    backgroundColor: colors.button,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  buttonText: {
    color: colors.text,
    fontSize: fontSizes.body,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emptyState: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: colors.button,
    color: colors.statusText,
  },
  list: {
    backgroundColor: colors.button,
    borderRadius: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eadfd2",
  },
  checkbox: {
    marginRight: 14,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  checkboxText: {
    fontSize: 16,
  },
  itemName: {
    flex: 1,
    fontSize: fontSizes.body,
    color: colors.text,
  },
  itemNameBought: {
    textDecorationLine: "line-through",
    color: colors.statusText,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
})
