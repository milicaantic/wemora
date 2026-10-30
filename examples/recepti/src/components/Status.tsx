export function Loading() {
  return <p className="status-message">Učitavanje…</p>
}

export function ErrorMessage() {
  return (
    <p className="status-message status-error" role="alert">
      Greška pri učitavanju podataka
    </p>
  )
}
