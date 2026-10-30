import { useState } from "react"

export function useThing() {
  return useState(window.innerWidth)
}
