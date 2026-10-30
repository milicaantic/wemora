import { createRoot } from "react-dom/client"
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom"
import { Root } from "./Root"
import Home from "./pages/Home"
import { About } from "./pages/About.jsx"
import { UserDetail } from "./pages/UserDetail"

// Declared here on purpose: a screen that lives in the route file.
function Stats() {
  return <p>Stats</p>
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      { index: true, element: <Home /> },
      { path: "about", Component: About },
      { path: "users/:userId", element: <UserDetail /> },
      { path: "settings", lazy: () => import("./pages/Settings") },
      { path: "old", element: <Navigate to="/about" /> },
      { path: "admin", children: [{ path: "stats", element: <Stats /> }] },
    ],
  },
])

createRoot(document.getElementById("root")).render(<RouterProvider router={router} />)
