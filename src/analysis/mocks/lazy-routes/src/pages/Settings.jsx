import { useThing } from "../hooks/useThing.js"

export default function Settings() {
  const [thing] = useThing()
  return <p title="hint">Settings {thing}</p>
}
