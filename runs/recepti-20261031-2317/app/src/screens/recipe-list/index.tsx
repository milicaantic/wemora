import { useMemo, useState } from "react"
import { Link } from "expo-router"
import { View, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native"
import { getCategories, getRecipes, formatRating } from "@/shared/data"
import { useAsync } from "@/shared/data"
import { useFavorites } from "@/shared/data"
import { Text, colors, fontSizes, lineHeights } from "@/shared/theme"

export default function RecipeListPage() {
  const state = useAsync(() => Promise.all([getRecipes(), getCategories()]), [])
  const [query, setQuery] = useState("")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const { isFavorite, toggle } = useFavorites()

  const recipes = state.status === "ok" ? state.data[0] : []
  const categories = state.status === "ok" ? state.data[1] : []
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return recipes.filter(
      (r) => r.name.toLowerCase().includes(needle) && (categoryId === null || r.categoryId === categoryId),
    )
  }, [recipes, query, categoryId])

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
        <Text role="alert" style={styles.errorText}>
          Greška pri učitavanju podataka
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text role="heading" style={styles.pageTitle}>
        Svi recepti
      </Text>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.section}>
          <Text>Pretraga</Text>
          <TextInput
            accessibilityLabel="Pretraga"
            style={styles.searchInput}
            placeholder="Naziv recepta"
            value={query}
            onChangeText={setQuery}
            placeholderTextColor="#999"
          />
        </View>

        {/* Category filter */}
        <View style={styles.section}>
          <Text style={styles.filterLabel}>Kategorija:</Text>
          <View style={styles.categoryButtons} role="group">
            <Pressable
              role="button"
              style={[styles.categoryButton, categoryId === null && styles.categoryButtonActive]}
              onPress={() => setCategoryId(null)}
            >
              <Text style={[styles.categoryButtonText, categoryId === null && styles.categoryButtonTextActive]}>
                Sve kategorije
              </Text>
            </Pressable>
            {categories.map((c) => (
              <Pressable
                key={c.id}
                role="button"
                style={[styles.categoryButton, categoryId === c.id && styles.categoryButtonActive]}
                onPress={() => setCategoryId(c.id)}
              >
                <Text style={[styles.categoryButtonText, categoryId === c.id && styles.categoryButtonTextActive]}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Recipe list or empty state */}
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nema recepata za zadatu pretragu</Text>
          </View>
        ) : (
          <View style={styles.recipeList} role="list">
            {visible.map((r) => (
              <View key={r.id} style={styles.recipeCard} role="listitem">
                <View style={styles.recipeRow}>
                  <View style={styles.recipeInfo}>
                    <Link href={`/recepti/${r.id}`} style={styles.recipeNameLink}>
                      <Text style={styles.recipeName}>{r.name}</Text>
                    </Link>
                    <Text style={styles.recipeDetail}>
                      Kategorija: {categoryName(r.categoryId)} · Vreme: {r.timeMin} min
                    </Text>
                    <Text style={styles.recipeDetail}>
                      Težina: {r.difficulty} · Porcije: {r.servings}
                    </Text>
                    <Text style={styles.recipeDetail}>
                      Kalorije: {r.calories} kcal · Ocena: {formatRating(r.rating)}
                    </Text>
                  </View>
                  <Pressable
                    role="button"
                    accessibilityLabel={`${isFavorite(r.id) ? "Ukloni iz omiljenih" : "Dodaj u omiljene"}: ${r.name}`}
                    onPress={() => toggle(r.id)}
                    style={styles.favoriteButton}
                  >
                    <Text style={[styles.favoriteStar, isFavorite(r.id) && styles.favoriteFilled]}>
                      {isFavorite(r.id) ? "★" : "☆"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  pageTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: lineHeights.pageTitle,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: colors.background,
  },
  section: {
    marginBottom: 20,
  },
  searchInput: {
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    borderRadius: 4,
    backgroundColor: colors.buttonBackground,
    color: colors.text,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  filterLabel: {
    marginBottom: 8,
  },
  categoryButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    borderRadius: 4,
    backgroundColor: colors.buttonBackground,
  },
  categoryButtonActive: {
    backgroundColor: colors.sidebarActive,
    borderColor: colors.sidebarActive,
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
  empty: {
    paddingVertical: 24,
    paddingHorizontal: 12,
    backgroundColor: colors.buttonBackground,
    borderRadius: 4,
  },
  emptyText: {
    color: colors.statusMessage,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  recipeList: {
    gap: 12,
  },
  recipeCard: {
    backgroundColor: colors.buttonBackground,
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eadfd2",
  },
  recipeRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  recipeInfo: {
    flex: 1,
    gap: 6,
  },
  recipeNameLink: {
    marginBottom: 4,
  },
  recipeName: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    fontWeight: "600",
    color: colors.link,
  },
  recipeDetail: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
  },
  favoriteButton: {
    padding: 4,
  },
  favoriteStar: {
    fontSize: 18,
    lineHeight: 21,
    color: colors.text,
  },
  favoriteFilled: {
    color: colors.sidebarActive,
  },
  loadingText: {
    marginTop: 12,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  errorText: {
    color: colors.statusError,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
})
