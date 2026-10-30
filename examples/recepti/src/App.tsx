import { Route, Routes } from "react-router-dom"
import { Layout } from "./components/Layout"
import { CategoriesPage } from "./pages/CategoriesPage"
import { FavoritesPage } from "./pages/FavoritesPage"
import { RecipeDetailPage } from "./pages/RecipeDetailPage"
import { RecipeListPage } from "./pages/RecipeListPage"
import { ShoppingListPage } from "./pages/ShoppingListPage"

// Nested on purpose: the parser has to join paths and treat Layout as shared, not as a screen.
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<RecipeListPage />} />
        <Route path="recepti/:id" element={<RecipeDetailPage />} />
        <Route path="kategorije" element={<CategoriesPage />} />
        <Route path="omiljeni" element={<FavoritesPage />} />
        <Route path="kupovina" element={<ShoppingListPage />} />
      </Route>
    </Routes>
  )
}
