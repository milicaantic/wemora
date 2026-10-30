import { useState } from "react"
import { Link } from "react-router-dom"
import { getCategories, getRecipes } from "../api/client"
import { useAsync } from "../api/useAsync"
import { ErrorMessage, Loading } from "../components/Status"
import "./CategoriesPage.css"

// List and detail side by side (master–detail): built for a desktop screen.
export function CategoriesPage() {
  const state = useAsync(() => Promise.all([getCategories(), getRecipes()]), [])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (state.status === "loading") return <Loading />
  if (state.status === "error") return <ErrorMessage />

  const [categories, recipes] = state.data
  const selected = categories.find((c) => c.id === selectedId) ?? null
  const inSelected = selected ? recipes.filter((r) => r.categoryId === selected.id) : []

  return (
    <section>
      <h2 className="page-title">Kategorije</h2>
      <div className="categories-layout">
        <ul className="category-list">
          {categories.map((c) => (
            <li key={c.id} className={c.id === selectedId ? "selected" : undefined}>
              <button type="button" aria-pressed={c.id === selectedId} onClick={() => setSelectedId(c.id)}>
                {c.name}
              </button>
              <span className="category-count">{recipes.filter((r) => r.categoryId === c.id).length}</span>
            </li>
          ))}
        </ul>

        <div className="category-detail">
          {selected === null ? (
            <p className="category-hint">Izaberite kategoriju</p>
          ) : (
            <>
              <h3>{selected.name}</h3>
              {inSelected.length === 0 ? (
                <p>U ovoj kategoriji nema recepata</p>
              ) : (
                <ul className="category-recipes">
                  {inSelected.map((r) => (
                    <li key={r.id}>
                      <Link to={`/recepti/${r.id}`}>{r.name}</Link>
                      <span className="category-recipe-meta">
                        {r.timeMin} min · {r.difficulty}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
