import React, { lazy, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Route, Routes } from "react-router-dom"

const Home = lazy(() => import("./pages/Home.jsx"))
const Settings = React.lazy(() => import("./pages/Settings"))

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/settings"
        element={
          <Suspense fallback={null}>
            <Settings />
          </Suspense>
        }
      />
    </Routes>
  </BrowserRouter>,
)
