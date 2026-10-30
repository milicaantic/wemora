import { useFavorites } from "../store/favorites"

type Props = {
  recipeId: string
  /** With a name, the button name is unique on a page with many recipes: "Dodaj u omiljene: Sarma". */
  recipeName?: string
  /** Star only, for table rows. The accessible name stays the full text. */
  compact?: boolean
}

export function FavoriteButton({ recipeId, recipeName, compact = false }: Props) {
  const { isFavorite, toggle } = useFavorites()
  const favorite = isFavorite(recipeId)
  const action = favorite ? "Ukloni iz omiljenih" : "Dodaj u omiljene"
  const name = recipeName ? `${action}: ${recipeName}` : action

  return (
    <button
      type="button"
      className={favorite ? "favorite-button favorite" : "favorite-button"}
      aria-label={compact ? name : undefined}
      title={compact ? name : undefined}
      onClick={() => toggle(recipeId)}
    >
      {compact ? (favorite ? "★" : "☆") : name}
    </button>
  )
}
