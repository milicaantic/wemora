// All data comes from examples/mock-api. The Expo app reads the same API.
export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000"

export type Ingredient = { name: string; amount: number; unit: string }

export type Recipe = {
  id: string
  name: string
  categoryId: string
  timeMin: number
  difficulty: "Lako" | "Srednje" | "Teško"
  servings: number
  calories: number
  rating: number
  ingredients: Ingredient[]
  /** Only present on the detail endpoint. */
  steps?: string[]
}

export type Category = { id: string; name: string }

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`)
  if (!response.ok) throw new Error(`GET ${path} failed with ${response.status}`)
  return (await response.json()) as T
}

export function getRecipes(): Promise<Recipe[]> {
  return getJson<Recipe[]>("/api/recipes")
}

/** Resolves to null when the recipe does not exist. */
export async function getRecipe(id: string): Promise<Recipe | null> {
  const response = await fetch(`${API_URL}/api/recipes/${encodeURIComponent(id)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`GET /api/recipes/${id} failed with ${response.status}`)
  return (await response.json()) as Recipe
}

export function getCategories(): Promise<Category[]> {
  return getJson<Category[]>("/api/categories")
}
