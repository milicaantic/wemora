import { useState } from "react"
import { View, ScrollView, StyleSheet, Pressable } from "react-native"
import { Link } from "expo-router"
import { Text, colors, fontSizes } from "@/shared/theme"
import { getCategories, getRecipes, type Category, type Recipe } from "@/shared/data/client"
import { useAsync } from "@/shared/data/useAsync"

function Loading() {
  return <Text style={styles.statusMessage}>Učitavanje…</Text>
}

function ErrorMessage() {
  return <Text style={[styles.statusMessage, styles.statusError]} role="alert">Greška pri učitavanju podataka</Text>
}

export default function CategoriesScreen() {
  const state = useAsync(() => Promise.all([getCategories(), getRecipes()]), [])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (state.status === "loading") return <Loading />
  if (state.status === "error") return <ErrorMessage />

  const [categories, recipes] = state.data
  const selected = categories.find((c) => c.id === selectedId) ?? null
  const inSelected = selected ? recipes.filter((r) => r.categoryId === selected.id) : []

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text role="heading" style={styles.pageTitle}>Kategorije</Text>

        <View style={styles.categoryList} role="list">
          {categories.map((category) => (
            <View key={category.id} style={styles.categoryRow} role="listitem">
              <Pressable
                role="button"
                onPress={() => setSelectedId(category.id)}
                style={[
                  styles.categoryButton,
                  category.id === selectedId && styles.categoryButtonSelected,
                ]}
                aria-pressed={category.id === selectedId}
              >
                <Text style={[
                  styles.categoryButtonText,
                  category.id === selectedId && styles.categoryButtonTextSelected,
                ]}>
                  {category.name}
                </Text>
              </Pressable>
              <Text style={styles.categoryCount}>
                {recipes.filter((r) => r.categoryId === category.id).length}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.categoryDetail}>
          {selected === null ? (
            <Text style={styles.categoryHint}>Izaberite kategoriju</Text>
          ) : (
            <>
              <Text role="heading" style={styles.categoryDetailTitle}>{selected.name}</Text>
              {inSelected.length === 0 ? (
                <Text style={styles.emptyMessage}>U ovoj kategoriji nema recepata</Text>
              ) : (
                <View style={styles.categoryRecipes} role="list">
                  {inSelected.map((recipe) => (
                    <View key={recipe.id} style={styles.recipeItem} role="listitem">
                      <View style={styles.recipeItemContent}>
                        <Link
                          href={`/recepti/${recipe.id}`}
                          style={styles.recipeLink}
                        >
                          <Text style={styles.recipeName}>{recipe.name}</Text>
                        </Link>
                        <Text style={styles.recipeMetadata}>
                          {recipe.timeMin} min · {recipe.difficulty}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
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
    paddingBottom: 100,
  },
  pageTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: 32,
    marginBottom: 16,
    fontWeight: "600",
  },
  categoryList: {
    backgroundColor: "#fff",
    borderRadius: 6,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  categoryRow: {
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
  categoryButtonText: {
    color: colors.text,
    fontSize: fontSizes.body,
  },
  categoryButtonTextSelected: {
    fontWeight: "600",
  },
  categoryCount: {
    color: colors.statusText,
    paddingRight: 8,
    fontSize: fontSizes.body,
  },
  categoryDetail: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 6,
  },
  categoryHint: {
    color: colors.statusText,
    fontSize: fontSizes.body,
  },
  categoryDetailTitle: {
    fontSize: 18,
    lineHeight: 22,
    marginTop: 0,
    marginBottom: 16,
    fontWeight: "600",
  },
  emptyMessage: {
    color: colors.text,
    fontSize: fontSizes.body,
  },
  categoryRecipes: {
    borderRadius: 4,
  },
  recipeItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eadfd2",
  },
  recipeItemContent: {
    flex: 1,
  },
  recipeLink: {
    textDecorationLine: "none",
  },
  recipeName: {
    color: colors.link,
    fontSize: fontSizes.body,
    marginBottom: 4,
  },
  recipeMetadata: {
    color: colors.statusText,
    fontSize: fontSizes.body,
  },
  statusMessage: {
    padding: 16,
    color: colors.statusText,
  },
  statusError: {
    color: colors.statusError,
  },
})
