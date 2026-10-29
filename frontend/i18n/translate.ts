// Shared by server and client: "{name} saved" + { name: "Haaland" } -> "Haaland saved"
export function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}

/** Looks up a label by key in a dictionary section, falling back to the raw key (e.g. an unmapped style label). */
export function label(section: Record<string, string>, key: string | null | undefined): string {
  if (!key) return ""
  return section[key] ?? key
}
