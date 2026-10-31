import { useState } from "react"
import { StyleSheet, View, TextInput, Pressable, ScrollView } from "react-native"
import { Text, colors, fontSizes, lineHeights } from "@/shared/theme"
import { useShoppingList } from "@/shared/data"

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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
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
          placeholder=""
        />
        <Pressable role="button" onPress={onSubmit} style={styles.button}>
          <Text style={styles.buttonText}>Dodaj</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Lista za kupovinu je prazna</Text>
        </View>
      ) : (
        <>
          <View style={styles.itemsList} role="list">
            {items.map((item) => (
              <View key={item.id} style={styles.itemRow} role="listitem">
                <Pressable
                  role="checkbox"
                  aria-checked={item.bought}
                  accessibilityLabel={item.name}
                  onPress={() => toggle(item.id)}
                  style={styles.checkbox}
                >
                  <View
                    style={[styles.checkboxBox, item.bought && styles.checkboxBoxChecked]}
                  >
                    {item.bought && <Text style={styles.checkmark}>✓</Text>}
                  </View>
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
            <Text style={styles.footerText}>
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
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  pageTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: lineHeights.pageTitle,
    marginBottom: 24,
    fontWeight: "600",
  },
  form: {
    gap: 12,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: colors.buttonBackground,
    fontSize: fontSizes.body,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.buttonBackground,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  emptyContainer: {
    backgroundColor: colors.buttonBackground,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  emptyText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.statusMessage,
  },
  itemsList: {
    gap: 0,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.buttonBackground,
    borderBottomWidth: 1,
    borderBottomColor: "#eadfd2",
  },
  checkbox: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    borderRadius: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxBoxChecked: {
    backgroundColor: colors.link,
    borderColor: colors.link,
  },
  checkmark: {
    color: colors.buttonBackground,
    fontSize: 14,
    fontWeight: "700",
  },
  itemName: {
    flex: 1,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
  },
  itemNameBought: {
    textDecorationLine: "line-through",
    color: "#8792a2",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  footerText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    flex: 1,
  },
})
