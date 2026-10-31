import { useEffect, useState } from "react"
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native"
import { Link, useLocalSearchParams, useRouter } from "expo-router"
import {
  getRecipe,
  getCategories,
  useAsync,
  formatRating,
  formatAmount,
  scaleAmount,
  useFavorites,
  useShoppingList,
} from "@/shared/data"
import { Text, colors, fontSizes } from "@/shared/theme"

export default function RecipeDetailScreen() {
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
        <Text>Učitavanje…</Text>
      </View>
    )
  }

  if (state.status === "error") {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Greška pri učitavanju podataka</Text>
      </View>
    )
  }

  if (!recipe) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text role="heading" style={styles.pageTitle}>
            Recept nije pronađen
          </Text>
          <Link href="/" style={styles.backLink}>
            <Text style={styles.backLinkText}>Nazad na recepte</Text>
          </Link>
        </ScrollView>
      </View>
    )
  }

  const category = state.status === "ok" ? state.data[1].find((c) => c.id === recipe.categoryId) : undefined
  const favorite = isFavorite(recipe.id)
  const favoriteAction = favorite ? "Ukloni iz omiljenih" : "Dodaj u omiljene"
  const favoriteLabel = `${favoriteAction}: ${recipe.name}`

  const ingredientText = (i: (typeof recipe.ingredients)[number]) =>
    `${i.name}: ${formatAmount(scaleAmount(i.amount, servings, recipe.servings))} ${i.unit}`

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Link href="/" style={styles.backLink}>
          <Text style={styles.backLinkText}>Nazad na recepte</Text>
        </Link>

        <View style={styles.headerContainer}>
          <Text role="heading" style={styles.pageTitle}>
            {recipe.name}
          </Text>
          <Pressable
            role="button"
            accessibilityLabel={favoriteLabel}
            onPress={() => toggle(recipe.id)}
            style={styles.favoriteButton}
          >
            <Text style={styles.favoriteButtonText}>{favorite ? "★" : "☆"}</Text>
          </Pressable>
        </View>

        <Text style={styles.metaText}>
          Kategorija: {category?.name ?? recipe.categoryId} · Vreme: {recipe.timeMin} min · Težina:{" "}
          {recipe.difficulty} · Ocena: {formatRating(recipe.rating)} · {recipe.calories} kcal po porciji
        </Text>

        <View style={styles.panel}>
          <Text role="heading" style={styles.panelTitle}>
            Sastojci
          </Text>

          <View style={styles.servingsContainer}>
            <Pressable
              role="button"
              onPress={() => setServings((s) => Math.max(1, s - 1))}
              disabled={servings <= 1}
              style={[styles.servingButton, servings <= 1 && styles.servingButtonDisabled]}
            >
              <Text style={styles.servingButtonText}>Smanji porcije</Text>
            </Pressable>
            <Text>Porcije: {servings}</Text>
            <Pressable role="button" onPress={() => setServings((s) => s + 1)} style={styles.servingButton}>
              <Text style={styles.servingButtonText}>Povećaj porcije</Text>
            </Pressable>
          </View>

          <View style={styles.ingredientsList} role="list">
            {recipe.ingredients.map((i) => (
              <View key={i.name} role="listitem" style={styles.ingredientItem}>
                <Text>{ingredientText(i)}</Text>
              </View>
            ))}
          </View>

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

          {added && <Text style={styles.addedMessage}>Sastojci su dodati u listu za kupovinu</Text>}
        </View>

        <View style={styles.panel}>
          <Text role="heading" style={styles.panelTitle}>
            Priprema
          </Text>
          <View style={styles.stepsList} role="list">
            {(recipe.steps ?? []).map((step, index) => (
              <View key={index} role="listitem" style={styles.stepItem}>
                <Text>{step}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 80,
  },
  backLink: {
    marginBottom: 16,
    textDecorationLine: "none",
  },
  backLinkText: {
    color: colors.link,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: 30,
    fontWeight: "700",
    marginBottom: 0,
    flex: 1,
  },
  favoriteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  favoriteButtonText: {
    fontSize: 20,
  },
  metaText: {
    color: colors.statusText,
    marginBottom: 24,
  },
  panel: {
    backgroundColor: colors.button,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 6,
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: fontSizes.body,
    fontWeight: "700",
    marginTop: 0,
    marginBottom: 12,
  },
  servingsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  servingButton: {
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.button,
  },
  servingButtonDisabled: {
    opacity: 0.5,
  },
  servingButtonText: {
    fontSize: fontSizes.body,
  },
  ingredientsList: {
    marginBottom: 16,
  },
  ingredientItem: {
    paddingLeft: 12,
    marginBottom: 8,
  },
  addButton: {
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.button,
    alignItems: "center",
  },
  addButtonText: {
    fontSize: fontSizes.body,
  },
  addedMessage: {
    color: "#2f7a3e",
    marginTop: 12,
    marginBottom: 0,
  },
  stepsList: {
    paddingLeft: 12,
  },
  stepItem: {
    marginBottom: 8,
  },
  error: {
    color: colors.statusError,
  },
})
