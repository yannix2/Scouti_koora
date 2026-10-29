"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Suspense, useEffect, useState, type ReactNode } from "react"
import { motion } from "motion/react"
import { useTheme } from "next-themes"
import { ArrowLeftRight, Compass, Languages, LayoutDashboard, LogIn, LogOut, Moon, Search, Star, Sun, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CommandPalette } from "./command-palette"
import { useI18n } from "@/i18n/client"
import { localeLabel, locales, type Locale } from "@/i18n/config"
import { useSession, useSignOut } from "@/features/auth/use-session"

function useNav() {
  const { dict, locale } = useI18n()
  return [
    { href: `/${locale}`, label: dict.nav.desk, icon: LayoutDashboard, exact: true },
    { href: `/${locale}/discover`, label: dict.nav.discover, icon: Compass },
    { href: `/${locale}/compare`, label: dict.nav.compare, icon: ArrowLeftRight },
    { href: `/${locale}/scouting`, label: dict.nav.scouting, icon: Star },
  ]
}

/** Inline mark: a centre circle cut by the halfway line, the pitch's own glyph. */
function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="2" y="5" width="28" height="22" rx="3" />
      <path d="M16 5v22" />
      <circle cx="16" cy="16" r="5" />
      <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function LanguageMenu({ compact }: { compact?: boolean }) {
  return (
    <Suspense fallback={<LanguageMenuInner compact={compact} pathname={null} />}>
      <LanguageMenuWithPath compact={compact} />
    </Suspense>
  )
}

function LanguageMenuWithPath({ compact }: { compact?: boolean }) {
  return <LanguageMenuInner compact={compact} pathname={usePathname()} />
}

function LanguageMenuInner({ compact, pathname: current }: { compact?: boolean; pathname: string | null }) {
  const { locale, dict } = useI18n()
  const pathname = current ?? `/${locale}`
  const router = useRouter()
  const switchTo = (next: string) => {
    document.cookie = `sk_locale=${next}; path=/; max-age=31536000; samesite=lax`
    router.push(pathname.replace(/^\/(en|fr|ar)/, `/${next}`) + window.location.search)
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "default"}
          className="text-rail-foreground hover:bg-sidebar-accent hover:text-rail-foreground"
          aria-label={dict.nav.language}
        >
          <Languages />
          {!compact && <span className="uppercase">{locale}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuLabel>{dict.nav.language}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={switchTo}>
          {locales.map((l: Locale) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l}>
              {localeLabel[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ThemeButton() {
  const { dict } = useI18n()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === "dark"
  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-rail-foreground hover:bg-sidebar-accent hover:text-rail-foreground"
      aria-label={dict.nav.theme}
      title={dark ? dict.nav.light : dict.nav.dark}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

function UserButton() {
  const { dict, locale } = useI18n()
  const { data: user } = useSession()
  const signOut = useSignOut()
  const router = useRouter()
  if (!user)
    return (
      <Button asChild className="w-full justify-start bg-rail-foreground text-rail hover:bg-rail-foreground/90">
        <Link href={`/${locale}/login`}>
          <LogIn data-icon="inline-start" />
          {dict.nav.signIn}
        </Link>
      </Button>
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-rail-foreground transition-colors hover:bg-sidebar-accent">
          <span className="grid size-8 place-items-center rounded-full bg-rail-foreground/15">
            <UserRound className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-rail-muted">{dict.auth.roles[user.role]}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => signOut.mutate(undefined, { onSuccess: () => router.push(`/${locale}`) })}
        >
          <LogOut />
          {dict.nav.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RailNav({ pathname }: { pathname: string | null }) {
  const nav = useNav()
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {nav.map((item) => {
        const active = isActive(pathname, item.href, item.exact)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              active ? "text-rail" : "text-rail-muted hover:bg-sidebar-accent hover:text-rail-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="rail-active"
                className="absolute inset-0 rounded-lg bg-rail-foreground shadow-md"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <item.icon className="relative size-4" />
            <span className="relative">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function TabBar({ pathname }: { pathname: string | null }) {
  const nav = useNav()
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-xl backdrop-blur lg:hidden">
      {nav.map((item) => {
        const active = isActive(pathname, item.href, item.exact)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium", active ? "text-turf" : "text-muted-foreground")}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

const isActive = (pathname: string | null, href: string, exact?: boolean) =>
  pathname != null && (exact ? pathname === href : pathname.startsWith(href))

function WithPath({ render }: { render: (pathname: string | null) => ReactNode }) {
  return <>{render(usePathname())}</>
}

/** Pathname is request data: read it inside Suspense so routes still prerender a static shell. */
function PathAware({ render }: { render: (pathname: string | null) => ReactNode }) {
  return (
    <Suspense fallback={render(null)}>
      <WithPath render={render} />
    </Suspense>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { dict, locale } = useI18n()
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-lg">
        {dict.nav.skip}
      </a>

      {/* Turf rail (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-rail px-3 py-5 text-rail-foreground shadow-xl lg:flex">
        <Link href={`/${locale}`} className="mb-7 flex items-center gap-2.5 px-2">
          <Mark className="size-7" />
          <span className="text-lg font-semibold tracking-tight">ScoutiKoora</span>
        </Link>

        <button
          onClick={() => setPaletteOpen(true)}
          className="mb-5 flex h-9 items-center gap-2 rounded-lg bg-rail-foreground/10 px-3 text-sm text-rail-muted transition-colors hover:bg-rail-foreground/15 hover:text-rail-foreground"
        >
          <Search className="size-4" />
          <span className="flex-1 text-start">{dict.nav.searchHint}</span>
          <kbd className="rounded border border-rail-foreground/20 px-1.5 text-[0.65rem]">Ctrl K</kbd>
        </button>

        <PathAware render={(p) => <RailNav pathname={p} />} />

        <div className="mt-auto flex flex-col gap-3">
          <div className="flex items-center gap-1">
            <LanguageMenu />
            <ThemeButton />
          </div>
          <UserButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-rail px-4 text-rail-foreground shadow-md lg:hidden">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <Mark className="size-6" />
            <span className="font-semibold">ScoutiKoora</span>
          </Link>
          <div className="ms-auto flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="text-rail-foreground hover:bg-sidebar-accent hover:text-rail-foreground"
              aria-label={dict.nav.search}
              onClick={() => setPaletteOpen(true)}
            >
              <Search />
            </Button>
            <LanguageMenu compact />
            <ThemeButton />
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 pb-20 lg:pb-0">
          {children}
        </main>

        {/* Mobile tab bar */}
        <PathAware render={(p) => <TabBar pathname={p} />} />
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
