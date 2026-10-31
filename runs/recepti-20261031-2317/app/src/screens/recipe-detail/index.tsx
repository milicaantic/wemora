import { useEffect, useState } from "react"
import { ScrollView, View, Pressable, StyleSheet, ActivityIndicator } from "react-native"
import { Link, useLocalSearchParams, useRouter } from "expo-router"
import { getRecipe, getCategories, useShoppingList, formatAmount, scaleAmount, formatRating, useAsync, useFavorites } from "@/shared/data"
import { Text, colors, fontSizes, fontWeights, lineHeights } from "@/shared/theme"

export default function RecipeDetailScreen() {
  const router = useRouter()
  const { id = "" } = useLocalSearchParams<{ id: string }>()
  const state = useAsync(() => Promise.all([getRecipe(id), getCategories()]), [id])
  const { addMany } = useShoppingList()
  const { isFavorite, toggle } = useFavorites()
  const [servings, setServings] = useState(1)
  const [added, setAdded] = useState(false)

  const recipe = state.status === "ok" ? state.data[0] : null

  useEffect(() => {
    if (recipe) setServings(recipe.servings)
    setAdded(false)
  }, [recipe])

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

  if (!recipe) {
    return (
      <View style={styles.container}>
        <Text role="heading" style={styles.pageTitle}>
          Recept nije pronađen
        </Text>
        <Link href="/" style={styles.backLink}>
          <Text style={styles.backLinkText}>Nazad na recepte</Text>
        </Link>
      </View>
    )
  }

  const category = state.status === "ok" ? state.data[1].find((c) => c.id === recipe.categoryId) : undefined
  const ingredientText = (i: (typeof recipe.ingredients)[number]) =>
    `${i.name}: ${formatAmount(scaleAmount(i.amount, servings, recipe.servings))} ${i.unit}`

  const isFav = isFavorite(recipe.id)
  const favButtonText = isFav ? "Ukloni iz omiljenih" : "Dodaj u omiljene"

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Back link */}
      <Link href="/" style={styles.backLink}>
        <Text style={styles.backLinkText}>Nazad na recepte</Text>
      </Link>

      {/* Header with title and favorite button */}
      <View style={styles.detailHeader}>
        <Text role="heading" style={styles.pageTitle}>
          {recipe.name}
        </Text>
        <Pressable
          role="button"
          onPress={() => toggle(recipe.id)}
          style={styles.favoriteButton}
          accessibilityLabel={favButtonText}
        >
          <Text style={styles.favoriteStar}>{isFav ? "★" : "☆"}</Text>
        </Pressable>
      </View>

      {/* Meta information */}
      <Text style={styles.detailMeta}>
        Kategorija: {category?.name ?? recipe.categoryId} · Vreme: {recipe.timeMin} min · Težina: {recipe.difficulty} ·
        Ocena: {formatRating(recipe.rating)} · {recipe.calories} kcal po porciji
      </Text>

      {/* Ingredients panel */}
      <View style={styles.detailPanel}>
        <Text role="heading" style={styles.panelTitle}>
          Sastojci
        </Text>

        {/* Servings controls */}
        <View style={styles.servings}>
          <Pressable
            role="button"
            onPress={() => setServings((s) => Math.max(1, s - 1))}
            disabled={servings <= 1}
            style={[styles.servingButton, servings <= 1 && styles.servingButtonDisabled]}
          >
            <Text style={[styles.servingButtonText, servings <= 1 && styles.servingButtonTextDisabled]}>
              Smanji porcije
            </Text>
          </Pressable>
          <Text style={styles.servingCount}>Porcije: {servings}</Text>
          <Pressable
            role="button"
            onPress={() => setServings((s) => s + 1)}
            style={styles.servingButton}
          >
            <Text style={styles.servingButtonText}>Povećaj porcije</Text>
          </Pressable>
        </View>

        {/* Ingredients list */}
        <View style={styles.ingredients} role="list">
          {recipe.ingredients.map((i) => (
            <View key={i.name} style={styles.ingredientItem} role="listitem">
              <Text>{ingredientText(i)}</Text>
            </View>
          ))}
        </View>

        {/* Add to shopping button */}
        <Pressable
          role="button"
          onPress={() => {
            addMany(recipe.ingredients.map(ingredientText))
            setAdded(true)
          }}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>Dodaj sastojke u listu za kupovinu</Text>
        </Pressable>

        {/* Added message */}
        {added && (
          <Text role="status" style={styles.addedMessage}>
            Sastojci su dodati u listu za kupovinu
          </Text>
        )}
      </View>

      {/* Steps panel */}
      <View style={styles.detailPanel}>
        <Text role="heading" style={styles.panelTitle}>
          Priprema
        </Text>
        <View style={styles.steps} role="list">
          {(recipe.steps ?? []).map((step, index) => (
            <View key={index} style={styles.stepItem} role="listitem">
              <Text style={styles.stepIndex}>{index + 1}.</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
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
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingText: {
    marginTop: 12,
    textAlign: "center",
    color: colors.statusMessage,
  },
  errorText: {
    color: colors.statusError,
    textAlign: "center",
  },
  backLink: {
    marginBottom: 16,
  },
  backLinkText: {
    color: colors.link,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 8,
  },
  pageTitle: {
    flex: 1,
    fontSize: fontSizes.pageTitle,
    lineHeight: 29,
    fontWeight: fontWeights.body,
    color: colors.text,
    marginBottom: 0,
  },
  favoriteButton: {
    padding: 8,
  },
  favoriteStar: {
    fontSize: 20,
    lineHeight: 20,
    color: colors.text,
  },
  detailMeta: {
    color: colors.statusMessage,
    marginBottom: 24,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  detailPanel: {
    backgroundColor: colors.buttonBackground,
    padding: 20,
    borderRadius: 6,
    marginBottom: 24,
  },
  panelTitle: {
    fontSize: fontSizes.body,
    fontWeight: fontWeights.body,
    color: colors.text,
    marginTop: 0,
    marginBottom: 16,
  },
  servings: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  servingButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    borderRadius: 4,
    backgroundColor: colors.buttonBackground,
  },
  servingButtonDisabled: {
    opacity: 0.5,
  },
  servingButtonText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
    textAlign: "center",
  },
  servingButtonTextDisabled: {
    opacity: 0.5,
  },
  servingCount: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
  },
  ingredients: {
    marginBottom: 20,
  },
  ingredientItem: {
    marginBottom: 8,
  },
  addButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    borderRadius: 4,
    backgroundColor: colors.buttonBackground,
    marginBottom: 12,
  },
  addButtonText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
    textAlign: "center",
  },
  addedMessage: {
    color: "#2f7a3e",
    marginBottom: 0,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  steps: {
    marginTop: 0,
  },
  stepItem: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  stepIndex: {
    fontWeight: fontWeights.body,
    minWidth: 24,
    color: colors.text,
  },
  stepText: {
    flex: 1,
    color: colors.text,
  },
})
