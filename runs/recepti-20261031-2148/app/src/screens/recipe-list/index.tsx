import { useMemo, useState } from "react"
import { View, TextInput, ScrollView, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native"
import { Link } from "expo-router"
import { getRecipes, getCategories, useAsync, formatRating } from "@/shared/data"
import { Text, colors, fontSizes, lineHeights } from "@/shared/theme"
import { FavoriteButton } from "./FavoriteButton"

export default function RecipeListScreen() {
  const state = useAsync(() => Promise.all([getRecipes(), getCategories()]), [])
  const [query, setQuery] = useState("")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [sortByTime, setSortByTime] = useState(false)

  const recipes = state.status === "ok" ? state.data[0] : []
  const categories = state.status === "ok" ? state.data[1] : []
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = recipes.filter(
      (r) => r.name.toLowerCase().includes(needle) && (categoryId === null || r.categoryId === categoryId),
    )
    return sortByTime ? [...filtered].sort((a, b) => a.timeMin - b.timeMin) : filtered
  }, [recipes, query, categoryId, sortByTime])

  if (state.status === "loading") {
    return (
      <View style={styles.container}>
        <Text style={styles.statusMessage}>Učitavanje…</Text>
      </View>
    )
  }

  if (state.status === "error") {
    return (
      <View style={styles.container}>
        <Text style={[styles.statusMessage, styles.errorMessage]} role="alert">
          Greška pri učitavanju podataka
        </Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text role="heading" style={styles.pageTitle}>
        Svi recepti
      </Text>

      <View style={styles.toolbar}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchLabel}>Pretraga</Text>
          <TextInput
            style={styles.searchInput}
            accessibilityLabel="Pretraga"
            placeholder="Naziv recepta"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      <View style={styles.categoryFilterContainer} role="group">
        <Text style={styles.categoryLabel}>Kategorija:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScrollView}>
          <Pressable
            role="button"
            onPress={() => setCategoryId(null)}
            style={[
              styles.categoryButton,
              categoryId === null && styles.categoryButtonActive,
            ]}
            aria-pressed={categoryId === null}
          >
            <Text
              style={[
                styles.categoryButtonText,
                categoryId === null && styles.categoryButtonTextActive,
              ]}
            >
              Sve kategorije
            </Text>
          </Pressable>
          {categories.map((c) => (
            <Pressable
              key={c.id}
              role="button"
              onPress={() => setCategoryId(c.id)}
              style={[
                styles.categoryButton,
                categoryId === c.id && styles.categoryButtonActive,
              ]}
              aria-pressed={categoryId === c.id}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  categoryId === c.id && styles.categoryButtonTextActive,
                ]}
              >
                {c.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {visible.length === 0 ? (
        <Text style={styles.emptyMessage}>Nema recepata za zadatu pretragu</Text>
      ) : (
        <View style={styles.recipeListContainer} role="list">
          {visible.map((r) => (
            <View
              key={r.id}
              style={styles.recipeItem}
              role="listitem"
            >
              <Link href={`/recepti/${r.id}`} style={styles.recipeLink}>
                <Text style={styles.recipeName}>{r.name}</Text>
              </Link>
              <View style={styles.recipeDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Kategorija:</Text>
                  <Text style={styles.detailValue}>{categoryName(r.categoryId)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Vreme:</Text>
                  <Text style={styles.detailValue}>{r.timeMin} min</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Težina:</Text>
                  <Text style={styles.detailValue}>{r.difficulty}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Porcije:</Text>
                  <Text style={styles.detailValue}>{r.servings}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Kalorije:</Text>
                  <Text style={styles.detailValue}>{r.calories} kcal</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Ocena:</Text>
                  <Text style={styles.detailValue}>{formatRating(r.rating)}</Text>
                </View>
              </View>
              <View style={styles.favoriteButtonContainer}>
                <FavoriteButton recipeId={r.id} recipeName={r.name} />
              </View>
            </View>
          ))}
        </View>
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
    paddingTop: 16,
    paddingBottom: 120,
  },
  pageTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: 32,
    fontWeight: "600",
    marginBottom: 20,
    color: colors.text,
  },
  toolbar: {
    marginBottom: 16,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchLabel: {
    marginBottom: 4,
    color: colors.text,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: fontSizes.body,
    color: colors.text,
    backgroundColor: colors.button,
  },
  categoryFilterContainer: {
    marginBottom: 20,
  },
  categoryLabel: {
    marginBottom: 8,
    color: colors.text,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    fontWeight: "600",
  },
  categoryScrollView: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  categoryButton: {
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    backgroundColor: colors.button,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: colors.sidebarLinkActive,
    borderColor: colors.sidebarLinkActive,
  },
  categoryButtonText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
  },
  categoryButtonTextActive: {
    color: colors.sidebarText,
    fontWeight: "600",
  },
  recipeListContainer: {
    marginTop: 16,
  },
  recipeItem: {
    backgroundColor: colors.button,
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eadfd2",
  },
  recipeLink: {
    textDecorationLine: "none",
    marginBottom: 8,
  },
  recipeName: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    fontWeight: "600",
    color: colors.link,
  },
  recipeDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
    fontWeight: "500",
    marginRight: 8,
    minWidth: 80,
  },
  detailValue: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
    flex: 1,
  },
  favoriteButtonContainer: {
    alignItems: "flex-end",
  },
  emptyMessage: {
    backgroundColor: colors.button,
    color: colors.statusText,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    padding: 24,
    borderRadius: 4,
    marginTop: 20,
  },
  statusMessage: {
    color: colors.statusText,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    padding: 16,
  },
  errorMessage: {
    color: colors.statusError,
  },
})
