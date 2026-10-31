import { useSegments } from "expo-router"
import { Link } from "expo-router"
import { StyleSheet, View } from "react-native"
import { Text, colors, fontSizes, lineHeights } from "@/shared/theme"

const LINKS = [
  { href: "/", label: "Recepti" },
  { href: "/kategorije", label: "Kategorije" },
  { href: "/omiljeni", label: "Omiljeni" },
  { href: "/kupovina", label: "Lista za kupovinu" },
]

export function BottomBar() {
  const segments = useSegments() as string[]

  const isActive = (href: string) => {
    if (href === "/") {
      return segments.length === 0
    }
    const routeSegment = href.slice(1)
    return segments[0] === routeSegment
  }

  return (
    <View style={styles.bar}>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          style={StyleSheet.flatten([styles.link, isActive(link.href) && styles.linkActive])}
        >
          <Text style={StyleSheet.flatten([styles.linkText, isActive(link.href) && styles.linkTextActive])}>
            {link.label}
          </Text>
        </Link>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.sidebarBackground,
    borderTopWidth: 1,
    borderTopColor: colors.buttonBorder,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  link: {
    flex: 1,
    minWidth: 60,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  linkActive: {
    backgroundColor: colors.sidebarActive,
  },
  linkText: {
    color: colors.sidebarText,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    textAlign: "center",
  },
  linkTextActive: {
    fontWeight: "600",
  },
})
