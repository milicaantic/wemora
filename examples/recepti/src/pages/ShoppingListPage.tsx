import { useState, type FormEvent } from "react"
import { useShoppingList } from "../store/shoppingList"
import "./ShoppingListPage.css"

// A table with a form above it; Enter in the field also adds an item.
export function ShoppingListPage() {
  const { items, add, toggle, clearBought } = useShoppingList()
  const [name, setName] = useState("")
  const boughtCount = items.filter((item) => item.bought).length

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim() === "") return
    add(name)
    setName("")
  }

  return (
    <section>
      <h2 className="page-title">Lista za kupovinu</h2>

      <form className="shopping-form" onSubmit={onSubmit}>
        <label htmlFor="namirnica">Namirnica</label>
        <input id="namirnica" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">Dodaj</button>
      </form>

      {items.length === 0 ? (
        <p className="shopping-empty">Lista za kupovinu je prazna</p>
      ) : (
        <>
          <table className="shopping-table">
            <thead>
              <tr>
                <th>Kupljeno</th>
                <th>Namirnica</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={item.bought ? "bought" : undefined}>
                  <td>
                    <input
                      id={`stavka-${item.id}`}
                      type="checkbox"
                      checked={item.bought}
                      onChange={() => toggle(item.id)}
                    />
                  </td>
                  <td>
                    <label htmlFor={`stavka-${item.id}`}>{item.name}</label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="shopping-footer">
            <span>
              Kupljeno: {boughtCount} od {items.length}
            </span>
            <button type="button" onClick={clearBought} disabled={boughtCount === 0}>
              Obriši kupljene
            </button>
          </div>
        </>
      )}
    </section>
  )
}
