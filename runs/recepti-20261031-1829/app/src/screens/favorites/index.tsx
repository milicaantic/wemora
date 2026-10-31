import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { Link } from "expo-router"
import { Text, colors, fontSizes, fontWeights, lineHeights } from "@/shared/theme"
import { useAsync, useFavorites, getRecipes } from "@/shared/data"

export default function FavoritesScreen() {
  const state = useAsync(() => getRecipes(), [])
  const { ids, toggle, isFavorite } = useFavorites()

  if (state.status === "loading") {
    return (
      <View style={styles.container}>
        <Text>Učitavanje…</Text>
      </View>
    )
  }

  if (state.status === "error") {
    return (
      <View style={styles.container}>
        <Text role="alert">Greška pri učitavanju podataka</Text>
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
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nemate omiljenih recepata</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          renderItem={({ item: recipe }) => (
            <View role="listitem" style={styles.card}>
              <Link
                href={`/recepti/${recipe.id}`}
                style={StyleSheet.flatten([styles.cardTitle])}
              >
                <Text style={styles.cardTitleText}>{recipe.name}</Text>
              </Link>

              <Text style={styles.cardMeta}>
                {recipe.timeMin} min · {recipe.difficulty} · {recipe.calories} kcal
              </Text>

              <Pressable
                role="button"
                onPress={() => toggle(recipe.id)}
                style={styles.removeButton}
                accessibilityLabel={`Ukloni iz omiljenih: ${recipe.name}`}
              >
                <Text style={styles.removeButtonText}>Ukloni iz omiljenih</Text>
              </Pressable>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
          nestedScrollEnabled={true}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  pageTitle: {
    fontSize: fontSizes.pageTitle,
    lineHeight: lineHeights.pageTitle,
    fontWeight: "600",
    marginBottom: 24,
    color: colors.text,
  },
  emptyContainer: {
    backgroundColor: colors.buttonBackground,
    borderRadius: 6,
    padding: 24,
  },
  emptyText: {
    color: colors.statusMessage,
  },
  listContent: {
    gap: 20,
  },
  card: {
    backgroundColor: colors.buttonBackground,
    borderRadius: 6,
    padding: 20,
  },
  cardTitle: {
    textDecorationLine: "none",
  },
  cardTitleText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: fontWeights.sidebarLinkActive,
    color: colors.link,
  },
  cardMeta: {
    color: colors.statusMessage,
    marginTop: 8,
    marginBottom: 12,
  },
  removeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.buttonBackground,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  removeButtonText: {
    color: colors.text,
  },
})
