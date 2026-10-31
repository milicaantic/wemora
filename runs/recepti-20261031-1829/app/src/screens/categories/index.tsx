import { useState } from "react"
import { View, ScrollView, Pressable, StyleSheet } from "react-native"
import { Link } from "expo-router"
import { getCategories, getRecipes } from "@/shared/data/api"
import { useAsync } from "@/shared/data/useAsync"
import { Text, colors, fontSizes, lineHeights } from "@/shared/theme"

export default function CategoriesScreen() {
  const state = useAsync(() => Promise.all([getCategories(), getRecipes()]), [])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (state.status === "loading") {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Učitavanje…</Text>
      </View>
    )
  }

  if (state.status === "error") {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Greška pri učitavanju podataka</Text>
      </View>
    )
  }

  const [categories, recipes] = state.data
  const selected = categories.find((c) => c.id === selectedId) ?? null
  const inSelected = selected ? recipes.filter((r) => r.categoryId === selected.id) : []

  return (
    <ScrollView style={styles.container}>
      <Text role="heading" style={styles.pageTitle}>Kategorije</Text>

      <View style={styles.categoryList} role="list">
        {categories.map((c) => {
          const count = recipes.filter((r) => r.categoryId === c.id).length
          const isSelected = c.id === selectedId

          return (
            <View key={c.id} role="listitem" style={[styles.categoryItem, isSelected && styles.categoryItemSelected]}>
              <Pressable
                role="button"
                accessibilityLabel={c.name}
                onPress={() => setSelectedId(c.id)}
                style={styles.categoryButton}
              >
                <Text style={styles.categoryName}>{c.name}</Text>
                <Text style={styles.categoryCount}>{count}</Text>
              </Pressable>
            </View>
          )
        })}
      </View>

      <View style={styles.detailSection}>
        {selected === null ? (
          <Text style={styles.hintText}>Izaberite kategoriju</Text>
        ) : (
          <>
            <Text role="heading" style={styles.detailTitle}>{selected.name}</Text>
            {inSelected.length === 0 ? (
              <Text style={styles.emptyText}>U ovoj kategoriji nema recepata</Text>
            ) : (
              <View style={styles.recipesList} role="list">
                {inSelected.map((r) => (
                  <View key={r.id} role="listitem" style={styles.recipeItem}>
                    <Link href={`/recepti/${r.id}`} style={styles.recipeLink}>
                      <Text style={styles.recipeName}>{r.name}</Text>
                    </Link>
                    <Text style={styles.recipeMeta}>
                      {r.timeMin} min · {r.difficulty}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  pageTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: lineHeights.pageTitle,
    fontWeight: "600",
    marginBottom: 24,
  },
  loadingText: {
    color: colors.statusMessage,
    paddingVertical: 16,
  },
  errorText: {
    color: colors.statusError,
    paddingVertical: 16,
  },
  categoryList: {
    backgroundColor: colors.buttonBackground,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  categoryItem: {
    borderRadius: 4,
    marginVertical: 4,
  },
  categoryItemSelected: {
    backgroundColor: "#fbe9dc",
  },
  categoryButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  categoryName: {
    flex: 1,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  categoryCount: {
    color: colors.statusMessage,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    paddingRight: 8,
  },
  detailSection: {
    backgroundColor: colors.buttonBackground,
    borderRadius: 6,
    padding: 20,
    marginBottom: 24,
  },
  detailTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: lineHeights.pageTitle,
    fontWeight: "600",
    marginBottom: 16,
    marginTop: 0,
  },
  hintText: {
    color: colors.statusMessage,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  emptyText: {
    color: colors.statusMessage,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  recipesList: {
    marginTop: 0,
  },
  recipeItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eadfd2",
  },
  recipeLink: {
    marginBottom: 4,
  },
  recipeName: {
    color: colors.link,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  recipeMeta: {
    color: colors.statusMessage,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
})
