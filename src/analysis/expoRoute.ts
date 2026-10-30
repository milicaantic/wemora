/**
 * Expo Router path for a React Router path (the values of Plan.routeMap).
 *   "/" → "/", "/recepti/:id" → "/recepti/[id]", "/docs/*" → "/docs/[...rest]",
 *   "*" → "/" when it is the app's only route (TodoMVC), otherwise "/[...rest]".
 */
export function expoRouteFor(webPath: string, allPaths: string[]): string {
  if (webPath === "*" || webPath === "/*") return allPaths.length === 1 ? "/" : "/[...rest]"
  const segments = webPath
    .split("/")
    .filter((s) => s !== "")
    .map((s) => {
      if (s === "*") return "[...rest]"
      if (s.startsWith(":")) return `[${s.slice(1).replace(/\?$/, "")}]`
      return s
    })
  return `/${segments.join("/")}`
}
