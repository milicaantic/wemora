import { Button } from "../shared/Button"

export default function Home() {
  return <Button onClick={() => localStorage.setItem("seen", "1")}>Home</Button>
}
