import { Link } from "react-router-dom"
import { getRecipes } from "../api/client"
import { useAsync } from "../api/useAsync"
import { FavoriteButton } from "../components/FavoriteButton"
import { ErrorMessage, Loading } from "../components/Status"
import { useFavorites } from "../store/favorites"
import "./FavoritesPage.css"

// A three-column card grid: built for a desktop screen.
export function FavoritesPage() {
  const state = useAsync(() => getRecipes(), [])
  const { ids } = useFavorites()

  if (state.status === "loading") return <Loading />
  if (state.status === "error") return <ErrorMessage />

  const favorites = state.data.filter((r) => ids.includes(r.id))

  return (
    <section>
      <h2 className="page-title">Omiljeni recepti</h2>
      {favorites.length === 0 ? (
        <p className="favorites-empty">Nemate omiljenih recepata</p>
      ) : (
        <ul className="favorites-grid">
          {favorites.map((r) => (
            <li key={r.id} className="favorite-card">
              <Link to={`/recepti/${r.id}`} className="favorite-card-title">
                {r.name}
              </Link>
              <p className="favorite-card-meta">
                {r.timeMin} min · {r.difficulty} · {r.calories} kcal
              </p>
              <FavoriteButton recipeId={r.id} recipeName={r.name} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
