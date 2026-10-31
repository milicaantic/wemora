import { View, StyleSheet, Pressable } from "react-native"
import { Link, usePathname } from "expo-router"
import { Text, colors, fontSizes, fontWeights } from "@/shared/theme"

const LINKS = [
  { href: "/", label: "Recepti", exact: true },
  { href: "/kategorije", label: "Kategorije", exact: false },
  { href: "/omiljeni", label: "Omiljeni", exact: false },
  { href: "/kupovina", label: "Lista za kupovinu", exact: false },
]

export function BottomBar() {
  const pathname = usePathname()

  return (
    <View style={styles.bottomBar}>
      {LINKS.map((link) => {
        const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            style={StyleSheet.flatten([
              styles.link,
              isActive && styles.linkActive,
            ])}
          >
            <Text style={StyleSheet.flatten([
              styles.linkText,
              isActive && styles.linkTextActive,
            ])}>
              {link.label}
            </Text>
          </Link>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bottomBar: {
    flexDirection: "row",
    backgroundColor: colors.sidebarBackground,
    borderTopWidth: 1,
    borderTopColor: colors.buttonBorder,
    paddingBottom: 8,
  },
  link: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    marginVertical: 8,
    textDecorationLine: "none",
  },
  linkActive: {
    backgroundColor: colors.sidebarLinkActive,
  },
  linkText: {
    color: colors.sidebarText,
    fontSize: fontSizes.body,
    textAlign: "center",
  },
  linkTextActive: {
    fontWeight: fontWeights.sidebarLinkActive,
  },
})
