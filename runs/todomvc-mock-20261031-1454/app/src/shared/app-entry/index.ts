// Web: src/index.js mounts <App> with createRoot inside a HashRouter with one route "*".
// Mobile: Expo Router does this. app/_layout.tsx is the root and the todo-list screen is the route "/".
// Nothing else to port; screens can read the app routes from here.
export const APP_ROUTES = ["/"] as const
