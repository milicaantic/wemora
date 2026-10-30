import { useParams } from "react-router-dom"

export function UserDetail() {
  const { userId } = useParams()
  return <p>User {userId}</p>
}
