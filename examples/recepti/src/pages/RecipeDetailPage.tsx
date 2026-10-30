import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { getCategories, getRecipe } from "../api/client"
import { useAsync } from "../api/useAsync"
import { FavoriteButton } from "../components/FavoriteButton"
import { ErrorMessage, Loading } from "../components/Status"
import { formatAmount, formatRating, scaleAmount } from "../format"
import { useShoppingList } from "../store/shoppingList"
import "./RecipeDetailPage.css"

// Two columns side by side (ingredients | steps): built for a desktop screen.
export function RecipeDetailPage() {
  const { id = "" } = useParams()
  const state = useAsync(() => Promise.all([getRecipe(id), getCategories()]), [id])
  const { addMany } = useShoppingList()
  const [servings, setServings] = useState(1)
  const [added, setAdded] = useState(false)

  const recipe = state.status === "ok" ? state.data[0] : null

  useEffect(() => {
    if (recipe) setServings(recipe.servings)
    setAdded(false)
  }, [recipe])

  if (state.status === "loading") return <Loading />
  if (state.status === "error") return <ErrorMessage />
  if (!recipe) {
    return (
      <section>
        <h2 className="page-title">Recept nije pronađen</h2>
        <Link to="/">Nazad na recepte</Link>
      </section>
    )
  }

  const category = state.status === "ok" ? state.data[1].find((c) => c.id === recipe.categoryId) : undefined
  const ingredientText = (i: (typeof recipe.ingredients)[number]) =>
    `${i.name}: ${formatAmount(scaleAmount(i.amount, servings, recipe.servings))} ${i.unit}`

  return (
    <section>
      <Link to="/" className="back-link">
        Nazad na recepte
      </Link>
      <div className="detail-header">
        <h2 className="page-title">{recipe.name}</h2>
        <FavoriteButton recipeId={recipe.id} />
      </div>
      <p className="detail-meta">
        Kategorija: {category?.name ?? recipe.categoryId} · Vreme: {recipe.timeMin} min · Težina: {recipe.difficulty} ·
        Ocena: {formatRating(recipe.rating)} · {recipe.calories} kcal po porciji
      </p>

      <div className="detail-columns">
        <div className="detail-panel">
          <h3>Sastojci</h3>
          <div className="servings">
            <button type="button" onClick={() => setServings((s) => s - 1)} disabled={servings <= 1}>
              Smanji porcije
            </button>
            <span>Porcije: {servings}</span>
            <button type="button" onClick={() => setServings((s) => s + 1)}>
              Povećaj porcije
            </button>
          </div>
          <ul className="ingredients">
            {recipe.ingredients.map((i) => (
              <li key={i.name}>{ingredientText(i)}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              addMany(recipe.ingredients.map(ingredientText))
              setAdded(true)
            }}
          >
            Dodaj sastojke u listu za kupovinu
          </button>
          {added && (
            <p role="status" className="added-message">
              Sastojci su dodati u listu za kupovinu
            </p>
          )}
        </div>

        <div className="detail-panel">
          <h3>Priprema</h3>
          <ol className="steps">
            {(recipe.steps ?? []).map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
