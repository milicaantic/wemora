import { View, ScrollView, StyleSheet, Pressable } from "react-native"
import { Link } from "expo-router"
import { Text, colors, fontSizes } from "@/shared/theme"
import { getRecipes, useAsync, useFavorites } from "@/shared/data"

export default function FavoritesScreen() {
  const state = useAsync(() => getRecipes(), [])
  const { ids, isFavorite, toggle } = useFavorites()

  if (state.status === "loading") {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle} role="heading">
          Omiljeni recepti
        </Text>
        <View style={styles.center}>
          <Text>Učitavanje…</Text>
        </View>
      </View>
    )
  }

  if (state.status === "error") {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle} role="heading">
          Omiljeni recepti
        </Text>
        <View style={styles.center}>
          <Text role="alert" style={{ color: colors.statusError }}>
            Greška pri učitavanju podataka
          </Text>
        </View>
      </View>
    )
  }

  const favorites = state.data.filter((r) => ids.includes(r.id))

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle} role="heading">
        Omiljeni recepti
      </Text>
      {favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nemate omiljenih recepata</Text>
        </View>
      ) : (
        <View style={styles.cardList} role="list">
          {favorites.map((recipe) => (
            <View key={recipe.id} style={styles.card} role="listitem">
              <Link href={`/recepti/${recipe.id}`} style={styles.cardTitle}>
                <Text style={{ fontSize: 18, fontWeight: "600", color: colors.link }}>
                  {recipe.name}
                </Text>
              </Link>
              <Text style={styles.cardMeta}>
                {recipe.timeMin} min · {recipe.difficulty} · {recipe.calories} kcal
              </Text>
              <View style={styles.cardFooter}>
                <Pressable
                  role="button"
                  onPress={() => toggle(recipe.id)}
                  accessibilityLabel={
                    isFavorite(recipe.id)
                      ? `Ukloni iz omiljenih: ${recipe.name}`
                      : `Dodaj u omiljene: ${recipe.name}`
                  }
                  style={styles.favoriteButton}
                >
                  <Text style={styles.star}>
                    {isFavorite(recipe.id) ? "★" : "☆"}
                  </Text>
                </Pressable>
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  pageTitle: {
    fontSize: fontSizes.pageTitle,
    fontWeight: "600",
    marginBottom: 16,
    color: colors.text,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyContainer: {
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyText: {
    color: colors.statusText,
  },
  cardList: {
    gap: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 16,
  },
  cardTitle: {
    marginBottom: 8,
  },
  cardMeta: {
    color: colors.statusText,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  favoriteButton: {
    padding: 8,
  },
  star: {
    fontSize: 20,
    color: colors.link,
  },
})
