import { Route, Routes } from "react-router-dom"
import { Missing } from "./nope"

export function App() {
  return (
    <Routes>
      <Route path="/x" element={<Missing />} />
    </Routes>
  )
}
