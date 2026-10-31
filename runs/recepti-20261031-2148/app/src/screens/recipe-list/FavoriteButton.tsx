import { Pressable, StyleSheet, Text as RNText } from "react-native"
import { useFavorites } from "@/shared/data"
import { Text, colors, fontSizes, lineHeights } from "@/shared/theme"

type Props = {
  recipeId: string
  recipeName: string
}

export function FavoriteButton({ recipeId, recipeName }: Props) {
  const { isFavorite, toggle } = useFavorites()
  const favorite = isFavorite(recipeId)
  const action = favorite ? "Ukloni iz omiljenih" : "Dodaj u omiljene"
  const name = `${action}: ${recipeName}`

  return (
    <Pressable
      role="button"
      onPress={() => toggle(recipeId)}
      style={[
        styles.button,
        favorite && styles.buttonFavorite,
      ]}
      accessibilityLabel={name}
    >
      <RNText style={[styles.buttonText, favorite && styles.buttonTextFavorite]}>
        {favorite ? "★" : "☆"}
      </RNText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.buttonBorder,
    backgroundColor: colors.button,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonFavorite: {
    backgroundColor: colors.button,
  },
  buttonText: {
    fontSize: 18,
    lineHeight: 18,
    color: colors.text,
  },
  buttonTextFavorite: {
    color: colors.sidebarLinkActive,
  },
})
