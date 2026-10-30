import { useThing } from "../hooks/useThing"

export default function Home() {
  const [thing] = useThing()
  return <p>Home {thing}</p>
}
