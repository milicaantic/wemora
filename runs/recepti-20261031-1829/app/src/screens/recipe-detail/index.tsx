import { useEffect, useState } from "react"
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native"
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
import { Text, colors, fontSizes, lineHeights } from "@/shared/theme"

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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.link} />
        <Text style={styles.loadingText}>Učitavanje…</Text>
      </View>
    )
  }

  if (state.status === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Greška pri učitavanju podataka</Text>
      </View>
    )
  }

  if (!recipe) {
    return (
      <View style={styles.container}>
        <Text role="heading" style={styles.pageTitle}>
          Recept nije pronađen
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Nazad na recepte</Text>
        </Link>
      </View>
    )
  }

  const category = state.status === "ok" ? state.data[1].find((c) => c.id === recipe.categoryId) : undefined
  const favorite = isFavorite(recipe.id)
  const ingredientText = (i: (typeof recipe.ingredients)[number]) =>
    `${i.name}: ${formatAmount(scaleAmount(i.amount, servings, recipe.servings))} ${i.unit}`

  const handleAddToShoppingList = () => {
    addMany(recipe.ingredients.map(ingredientText))
    setAdded(true)
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Link href="/" style={styles.link}>
        <Text style={styles.linkText}>Nazad na recepte</Text>
      </Link>

      <View style={styles.header}>
        <Text role="heading" style={styles.pageTitle}>
          {recipe.name}
        </Text>
        <Pressable
          role="button"
          onPress={() => toggle(recipe.id)}
          accessibilityLabel={favorite ? "Ukloni iz omiljenih" : "Dodaj u omiljene"}
          style={styles.favoriteButton}
        >
          <Text style={styles.favoriteButtonText}>{favorite ? "★" : "☆"}</Text>
        </Pressable>
      </View>

      <Text style={styles.meta}>
        Kategorija: {category?.name ?? recipe.categoryId} · Vreme: {recipe.timeMin} min · Težina:{" "}
        {recipe.difficulty} · Ocena: {formatRating(recipe.rating)} · {recipe.calories} kcal po porciji
      </Text>

      <View style={styles.section}>
        <Text role="heading" style={styles.sectionTitle}>
          Sastojci
        </Text>

        <View style={styles.servings}>
          <Pressable
            role="button"
            onPress={() => setServings((s) => s - 1)}
            disabled={servings <= 1}
            style={[styles.servingsButton, servings <= 1 && styles.servingsButtonDisabled]}
          >
            <Text style={styles.servingsButtonText}>Smanji porcije</Text>
          </Pressable>
          <Text style={styles.servingsText}>Porcije: {servings}</Text>
          <Pressable
            role="button"
            onPress={() => setServings((s) => s + 1)}
            style={styles.servingsButton}
          >
            <Text style={styles.servingsButtonText}>Povećaj porcije</Text>
          </Pressable>
        </View>

        <View role="list" style={styles.ingredients}>
          {recipe.ingredients.map((i) => (
            <View key={i.name} role="listitem" style={styles.ingredientItem}>
              <Text>{ingredientText(i)}</Text>
            </View>
          ))}
        </View>

        <Pressable
          role="button"
          onPress={handleAddToShoppingList}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>Dodaj sastojke u listu za kupovinu</Text>
        </Pressable>

        {added && (
          <Text style={styles.addedMessage}>Sastojci su dodati u listu za kupovinu</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text role="heading" style={styles.sectionTitle}>
          Priprema
        </Text>
        <View role="list" style={styles.steps}>
          {(recipe.steps ?? []).map((step, index) => (
            <View key={index} role="listitem" style={styles.stepItem}>
              <Text style={styles.stepNumber}>{index + 1}.</Text>
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: colors.statusMessage,
  },
  errorText: {
    color: colors.statusError,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  link: {
    marginBottom: 16,
  },
  linkText: {
    color: colors.link,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  pageTitle: {
    flex: 1,
    fontSize: fontSizes.pageTitle,
    lineHeight: lineHeights.pageTitle,
    fontWeight: "600",
    color: colors.text,
  },
  favoriteButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  favoriteButtonText: {
    fontSize: 20,
    color: colors.link,
  },
  meta: {
    color: colors.statusMessage,
    marginBottom: 24,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  section: {
    backgroundColor: colors.buttonBackground,
    padding: 16,
    borderRadius: 6,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 19,
    color: colors.text,
    marginBottom: 12,
    marginTop: 0,
  },
  servings: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  servingsButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.buttonBackground,
    borderRadius: 4,
  },
  servingsButtonDisabled: {
    opacity: 0.5,
  },
  servingsButtonText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
  },
  servingsText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
  },
  ingredients: {
    marginBottom: 16,
  },
  ingredientItem: {
    marginBottom: 8,
    paddingLeft: 16,
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.buttonBackground,
    borderRadius: 4,
    marginBottom: 12,
  },
  addButtonText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
    fontWeight: "600",
  },
  addedMessage: {
    color: "#2f7a3e",
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    marginBottom: 0,
  },
  steps: {
    marginTop: 0,
  },
  stepItem: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 8,
  },
  stepNumber: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
    fontWeight: "600",
    minWidth: 24,
  },
  stepText: {
    flex: 1,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    color: colors.text,
  },
})
