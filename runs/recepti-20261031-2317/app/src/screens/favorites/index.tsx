import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { Link } from "expo-router"
import { Text, colors, fontSizes, lineHeights } from "@/shared/theme"
import { getRecipes, useAsync, useFavorites } from "@/shared/data"

export default function FavoritesScreen() {
  const state = useAsync(() => getRecipes(), [])
  const { ids } = useFavorites()

  if (state.status === "loading") {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>Omiljeni recepti</Text>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.text} />
          <Text style={styles.statusMessage}>Učitavanje…</Text>
        </View>
      </View>
    )
  }

  if (state.status === "error") {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>Omiljeni recepti</Text>
        <View style={styles.centerContent}>
          <Text style={[styles.statusMessage, styles.statusError]} role="alert">
            Greška pri učitavanju podataka
          </Text>
        </View>
      </View>
    )
  }

  const favorites = state.data.filter((r) => ids.includes(r.id))

  return (
    <View style={styles.container}>
      <Text role="heading" style={styles.pageTitle}>
        Omiljeni recepti
      </Text>
      {favorites.length === 0 ? (
        <ScrollView style={styles.content}>
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Nemate omiljenih recepata</Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          renderItem={({ item: recipe }) => (
            <View role="listitem" style={styles.cardContainer}>
              <Link
                href={`/recepti/${recipe.id}`}
                style={styles.cardTitle}
                accessible
                accessibilityRole="link"
              >
                <Text style={styles.titleText}>{recipe.name}</Text>
              </Link>
              <Text style={styles.metaText}>
                {recipe.timeMin} min · {recipe.difficulty} · {recipe.calories} kcal
              </Text>
              <FavoriteButton recipeId={recipe.id} recipeName={recipe.name} />
            </View>
          )}
          scrollEnabled
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  )
}

type FavoriteButtonProps = {
  recipeId: string
  recipeName?: string
}

function FavoriteButton({ recipeId, recipeName }: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorites()
  const favorite = isFavorite(recipeId)
  const action = favorite ? "Ukloni iz omiljenih" : "Dodaj u omiljene"
  const name = recipeName ? `${action}: ${recipeName}` : action

  return (
    <Pressable
      role="button"
      accessibilityLabel={name}
      onPress={() => toggle(recipeId)}
      style={styles.button}
    >
      <Text style={[styles.buttonText, favorite && styles.buttonFavorite]}>{name}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pageTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: lineHeights.pageTitle,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  statusMessage: {
    color: colors.statusMessage,
  },
  statusError: {
    color: colors.statusError,
  },
  emptyBox: {
    backgroundColor: colors.buttonBackground,
    borderRadius: 6,
    padding: 24,
    margin: 16,
  },
  emptyText: {
    color: colors.statusMessage,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  cardContainer: {
    backgroundColor: colors.buttonBackground,
    borderRadius: 6,
    padding: 20,
  },
  cardTitle: {
    marginBottom: 8,
  },
  titleText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600",
  },
  metaText: {
    color: colors.statusMessage,
    marginBottom: 12,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    backgroundColor: colors.buttonBackground,
  },
  buttonText: {
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  buttonFavorite: {
    fontWeight: "600",
  },
})
