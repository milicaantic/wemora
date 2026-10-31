import { useMemo, useState } from "react"
import { View, TextInput, ScrollView, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native"
import { Link } from "expo-router"
import { getRecipes, getCategories, useAsync, useFavorites, formatRating } from "@/shared/data"
import { Text, colors, fontSizes, lineHeights } from "@/shared/theme"

type Recipe = {
  id: string
  name: string
  categoryId: string
  timeMin: number
  difficulty: "Lako" | "Srednje" | "Teško"
  servings: number
  calories: number
  rating: number
  ingredients: { name: string; amount: number; unit: string }[]
  steps?: string[]
}

export default function RecipeListScreen() {
  const state = useAsync(() => Promise.all([getRecipes(), getCategories()]), [])
  const { isFavorite, toggle } = useFavorites()
  const [query, setQuery] = useState("")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [sortByTime, setSortByTime] = useState(false)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)

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
        <ActivityIndicator />
        <Text>Učitavanje…</Text>
      </View>
    )
  }

  if (state.status === "error") {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText} role="alert">
          Greška pri učitavanju podataka
        </Text>
      </View>
    )
  }

  if (selectedRecipeId !== null) {
    const recipe = recipes.find((r) => r.id === selectedRecipeId)
    if (recipe) {
      return (
        <RecipeDetailView
          recipe={recipe}
          categoryName={categoryName(recipe.categoryId)}
          isFavorite={isFavorite}
          toggle={toggle}
          onBack={() => setSelectedRecipeId(null)}
        />
      )
    }
  }

  const renderRecipeCard = ({ item: recipe }: { item: (typeof recipes)[0] }) => {
    const favorite = isFavorite(recipe.id)
    const favoriteLabel = favorite ? `Ukloni iz omiljenih: ${recipe.name}` : `Dodaj u omiljene: ${recipe.name}`

    return (
      <View style={styles.card} role="listitem">
        <View style={styles.cardHeader}>
          <Pressable onPress={() => setSelectedRecipeId(recipe.id)} accessibilityRole="link">
            <Text style={styles.recipeName}>{recipe.name}</Text>
          </Pressable>
        </View>
        <View style={styles.cardDetails}>
          <Text style={styles.detail}>
            <Text style={styles.detailLabel}>Kategorija: </Text>
            {categoryName(recipe.categoryId)}
          </Text>
          <Text style={styles.detail}>
            <Text style={styles.detailLabel}>Vreme: </Text>
            {recipe.timeMin} min
          </Text>
          <Text style={styles.detail}>
            <Text style={styles.detailLabel}>Težina: </Text>
            {recipe.difficulty}
          </Text>
          <Text style={styles.detail}>
            <Text style={styles.detailLabel}>Porcije: </Text>
            {recipe.servings}
          </Text>
          <Text style={styles.detail}>
            <Text style={styles.detailLabel}>Kalorije: </Text>
            {recipe.calories} kcal
          </Text>
          <Text style={styles.detail}>
            <Text style={styles.detailLabel}>Ocena: </Text>
            {formatRating(recipe.rating)}
          </Text>
        </View>
        <View style={styles.cardFooter}>
          <Pressable
            role="button"
            accessibilityLabel={favoriteLabel}
            onPress={() => toggle(recipe.id)}
            style={styles.favoriteButton}
          >
            <Text style={[styles.favoriteStar, favorite && styles.favoriteActive]}>
              {favorite ? "★" : "☆"}
            </Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text role="heading" style={styles.pageTitle}>
        Svi recepti
      </Text>

      <ScrollView style={styles.toolbar} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <Text style={styles.label}>Pretraga</Text>
          <TextInput
            accessibilityLabel="Pretraga"
            style={styles.searchInput}
            placeholder="Naziv recepta"
            value={query}
            onChangeText={setQuery}
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Kategorija:</Text>
          <View style={styles.categoryButtons} role="group">
            <Pressable
              role="button"
              onPress={() => setCategoryId(null)}
              style={StyleSheet.flatten([
                styles.categoryButton,
                categoryId === null ? styles.categoryButtonActive : undefined,
              ])}
            >
              <Text
                style={StyleSheet.flatten([
                  styles.categoryButtonText,
                  categoryId === null ? styles.categoryButtonTextActive : undefined,
                ])}
              >
                Sve kategorije
              </Text>
            </Pressable>
            {categories.map((c) => (
              <Pressable
                key={c.id}
                role="button"
                onPress={() => setCategoryId(c.id)}
                style={StyleSheet.flatten([
                  styles.categoryButton,
                  categoryId === c.id ? styles.categoryButtonActive : undefined,
                ])}
              >
                <Text
                  style={StyleSheet.flatten([
                    styles.categoryButtonText,
                    categoryId === c.id ? styles.categoryButtonTextActive : undefined,
                  ])}
                >
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          role="button"
          onPress={() => setSortByTime((s) => !s)}
          style={StyleSheet.flatten([
            styles.sortButton,
            sortByTime ? styles.sortButtonActive : undefined,
          ])}
        >
          <Text
            style={StyleSheet.flatten([
              styles.sortButtonText,
              sortByTime ? styles.sortButtonTextActive : undefined,
            ])}
          >
            Sortiraj po vremenu
          </Text>
        </Pressable>
      </ScrollView>

      {visible.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nema recepata za zadatu pretragu</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.id}
          renderItem={renderRecipeCard}
          style={styles.list}
          scrollEnabled={true}
          role="list"
        />
      )}
    </View>
  )
}

type RecipeDetailViewProps = {
  recipe: Recipe
  categoryName: string
  isFavorite: (id: string) => boolean
  toggle: (id: string) => void
  onBack: () => void
}

function RecipeDetailView({ recipe, categoryName, isFavorite, toggle, onBack }: RecipeDetailViewProps) {
  const favorite = isFavorite(recipe.id)
  const favoriteLabel = favorite
    ? `Ukloni iz omiljenih: ${recipe.name}`
    : `Dodaj u omiljene: ${recipe.name}`

  return (
    <ScrollView style={styles.detailScrollContainer} contentContainerStyle={styles.detailContainer}>
      <Pressable role="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Nazad na recepte</Text>
      </Pressable>

      <Text role="heading" style={styles.pageTitle}>
        {recipe.name}
      </Text>

      <View style={styles.actionsRow}>
        <Pressable
          role="button"
          accessibilityLabel={favoriteLabel}
          onPress={() => toggle(recipe.id)}
          style={styles.favoriteButton}
        >
          <Text style={[styles.favoriteStar, favorite && styles.favoriteActive]}>
            {favorite ? "★" : "☆"}
          </Text>
          <Text style={styles.favoriteButtonLabel}>
            {favorite ? "Ukloni iz omiljenih" : "Dodaj u omiljene"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.detail}>
          <Text style={styles.detailLabel}>Kategorija: </Text>
          {categoryName}
        </Text>
        <Text style={styles.detail}>
          <Text style={styles.detailLabel}>Vreme: </Text>
          {recipe.timeMin} min
        </Text>
        <Text style={styles.detail}>
          <Text style={styles.detailLabel}>Težina: </Text>
          {recipe.difficulty}
        </Text>
        <Text style={styles.detail}>
          <Text style={styles.detailLabel}>Porcije: </Text>
          {recipe.servings}
        </Text>
        <Text style={styles.detail}>
          <Text style={styles.detailLabel}>Kalorije: </Text>
          {recipe.calories} kcal
        </Text>
        <Text style={styles.detail}>
          <Text style={styles.detailLabel}>Ocena: </Text>
          {formatRating(recipe.rating)}
        </Text>
      </View>

      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <View style={styles.section}>
          <Text role="heading" style={styles.sectionTitle}>
            Sastojci
          </Text>
          <View role="list">
            {recipe.ingredients.map((ing, idx) => (
              <View key={idx} role="listitem" style={styles.ingredientRow}>
                <Text style={styles.detail}>
                  {ing.name}: {ing.amount} {ing.unit}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {recipe.steps && recipe.steps.length > 0 && (
        <View style={styles.section}>
          <Text role="heading" style={styles.sectionTitle}>
            Koraci
          </Text>
          <View role="list">
            {recipe.steps.map((step, idx) => (
              <View key={idx} role="listitem" style={styles.stepRow}>
                <Text style={styles.detail}>
                  {idx + 1}. {step}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  pageTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: lineHeights.pageTitle,
    fontWeight: "600",
    marginBottom: 16,
    color: colors.text,
  },
  toolbar: {
    marginBottom: 16,
    maxHeight: 300,
  },
  searchContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    marginBottom: 4,
    color: colors.text,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: fontSizes.body,
    color: colors.text,
    backgroundColor: colors.buttonBackground,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    marginBottom: 8,
    marginRight: 4,
    color: colors.text,
  },
  categoryButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.buttonBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  categoryButtonActive: {
    backgroundColor: "#c8622a",
    borderColor: "#c8622a",
  },
  categoryButtonText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
  },
  categoryButtonTextActive: {
    color: "#fff",
  },
  sortButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.buttonBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  sortButtonActive: {
    backgroundColor: "#c8622a",
    borderColor: "#c8622a",
  },
  sortButtonText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
  },
  sortButtonTextActive: {
    color: "#fff",
  },
  list: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.buttonBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
  },
  cardHeader: {
    marginBottom: 8,
  },
  recipeLink: {
    textDecorationLine: "none",
  },
  recipeName: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    fontWeight: "600",
    color: colors.link,
  },
  cardDetails: {
    marginBottom: 8,
    gap: 4,
  },
  detail: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
  },
  detailLabel: {
    fontWeight: "600",
  },
  cardFooter: {
    alignItems: "flex-start",
  },
  favoriteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.buttonBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  favoriteStar: {
    fontSize: 18,
    lineHeight: 22,
    color: colors.text,
  },
  favoriteActive: {
    color: "#c8622a",
  },
  favoriteButtonLabel: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
  },
  emptyContainer: {
    backgroundColor: colors.buttonBackground,
    padding: 24,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.statusMessage,
  },
  // Detail view styles
  detailScrollContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  detailContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backButtonText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.link,
  },
  actionsRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  infoSection: {
    backgroundColor: colors.buttonBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  ingredientRow: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
})
