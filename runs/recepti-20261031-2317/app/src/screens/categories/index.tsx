import React from "react"
import { ActivityIndicator, ScrollView, StyleSheet, View, Pressable } from "react-native"
import { Link } from "expo-router"
import { getCategories, getRecipes, type Category, type Recipe } from "@/shared/data/api"
import { useAsync } from "@/shared/data/useAsync"
import { Text, colors, fontSizes, lineHeights } from "@/shared/theme"

export default function CategoriesScreen() {
  const state = useAsync(() => Promise.all([getCategories(), getRecipes()]), [])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  if (state.status === "loading") {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={styles.loadingText}>Učitavanje…</Text>
      </View>
    )
  }

  if (state.status === "error") {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText} role="alert">
          Greška pri učitavanju podataka
        </Text>
      </View>
    )
  }

  const [categories, recipes] = state.data
  const selected = categories.find((c) => c.id === selectedId) ?? null
  const inSelected = selected ? recipes.filter((r) => r.categoryId === selected.id) : []

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text role="heading" style={styles.pageTitle}>
        Kategorije
      </Text>

      <View style={styles.categoryList} role="list">
        {categories.map((c) => (
          <View key={c.id} style={styles.categoryItem} role="listitem">
            <Pressable
              role="button"
              onPress={() => setSelectedId(c.id)}
              style={[styles.categoryButton, c.id === selectedId && styles.categoryButtonSelected]}
            >
              <Text style={[styles.categoryName, c.id === selectedId && styles.categoryNameSelected]}>
                {c.name}
              </Text>
            </Pressable>
            <Text style={styles.categoryCount}>
              {recipes.filter((r) => r.categoryId === c.id).length}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.detailSection}>
        {selected === null ? (
          <Text style={styles.categoryHint}>Izaberite kategoriju</Text>
        ) : (
          <>
            <Text role="heading" style={styles.selectedCategoryTitle}>
              {selected.name}
            </Text>
            {inSelected.length === 0 ? (
              <Text>U ovoj kategoriji nema recepata</Text>
            ) : (
              <View style={styles.recipeList} role="list">
                {inSelected.map((r) => (
                  <View key={r.id} style={styles.recipeItem} role="listitem">
                    <View style={styles.recipeContent}>
                      <Link href={`/recepti/${r.id}`} style={styles.recipeLink}>
                        <Text style={styles.recipeName}>{r.name}</Text>
                      </Link>
                      <Text style={styles.recipeMetadata}>
                        {r.timeMin} min · {r.difficulty}
                      </Text>
                    </View>
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
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  pageTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: lineHeights.pageTitle,
    fontWeight: "600",
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 8,
    textAlign: "center",
  },
  errorText: {
    color: colors.statusError,
    textAlign: "center",
  },
  categoryList: {
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  categoryButtonSelected: {
    backgroundColor: "#fbe9dc",
  },
  categoryName: {
    color: colors.text,
  },
  categoryNameSelected: {
    fontWeight: "600",
  },
  categoryCount: {
    color: colors.statusMessage,
    paddingRight: 8,
  },
  detailSection: {
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
  },
  categoryHint: {
    color: colors.statusMessage,
  },
  selectedCategoryTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: lineHeights.pageTitle,
    fontWeight: "600",
    marginBottom: 12,
  },
  recipeList: {
    gap: 0,
  },
  recipeItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eadfd2",
  },
  recipeContent: {
    flex: 1,
  },
  recipeLink: {
    marginBottom: 4,
  },
  recipeName: {
    color: colors.link,
  },
  recipeMetadata: {
    color: colors.statusMessage,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
})
