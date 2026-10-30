import { NavLink } from "react-router-dom"

const LINKS = [
  { to: "/", label: "Recepti", end: true },
  { to: "/kategorije", label: "Kategorije", end: false },
  { to: "/omiljeni", label: "Omiljeni", end: false },
  { to: "/kupovina", label: "Lista za kupovinu", end: false },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <h1 className="sidebar-title">Recepti</h1>
      <nav aria-label="Glavni meni">
        <ul className="sidebar-links">
          {LINKS.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
