import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { getCategories, getRecipes } from "../api/client"
import { useAsync } from "../api/useAsync"
import { FavoriteButton } from "../components/FavoriteButton"
import { ErrorMessage, Loading } from "../components/Status"
import { formatRating } from "../format"
import "./RecipeListPage.css"

// A wide 8-column table with hover details: built for a desktop screen.
export function RecipeListPage() {
  const state = useAsync(() => Promise.all([getRecipes(), getCategories()]), [])
  const [query, setQuery] = useState("")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [sortByTime, setSortByTime] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

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

  if (state.status === "loading") return <Loading />
  if (state.status === "error") return <ErrorMessage />

  return (
    <section>
      <h2 className="page-title">Svi recepti</h2>

      <div className="toolbar">
        <div className="search">
          <label htmlFor="pretraga">Pretraga</label>
          <input
            id="pretraga"
            type="search"
            value={query}
            placeholder="Naziv recepta"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="category-filter" role="group" aria-label="Kategorija">
          <span className="category-filter-label">Kategorija:</span>
          <button type="button" aria-pressed={categoryId === null} onClick={() => setCategoryId(null)}>
            Sve kategorije
          </button>
          {categories.map((c) => (
            <button key={c.id} type="button" aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              {c.name}
            </button>
          ))}
        </div>

        <button type="button" aria-pressed={sortByTime} onClick={() => setSortByTime((s) => !s)}>
          Sortiraj po vremenu
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="empty">Nema recepata za zadatu pretragu</p>
      ) : (
        <table className="recipe-table">
          <thead>
            <tr>
              <th>Naziv</th>
              <th>Kategorija</th>
              <th>Vreme</th>
              <th>Težina</th>
              <th>Porcije</th>
              <th>Kalorije</th>
              <th>Ocena</th>
              <th>Omiljeni</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.id}
                onMouseEnter={() => setHoveredId(r.id)}
                onMouseLeave={() => setHoveredId((id) => (id === r.id ? null : id))}
              >
                <td className="name-cell">
                  <Link to={`/recepti/${r.id}`}>{r.name}</Link>
                  {hoveredId === r.id && (
                    <div role="tooltip" className="ingredients-tooltip">
                      Sastojci: {r.ingredients.map((i) => i.name).join(", ")}
                    </div>
                  )}
                </td>
                <td>{categoryName(r.categoryId)}</td>
                <td>{r.timeMin} min</td>
                <td>{r.difficulty}</td>
                <td>{r.servings}</td>
                <td>{r.calories} kcal</td>
                <td>{formatRating(r.rating)}</td>
                <td>
                  <FavoriteButton recipeId={r.id} recipeName={r.name} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
