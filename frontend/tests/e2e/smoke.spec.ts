import { expect, test, type Page } from "@playwright/test"

const SHOTS = process.env.SHOTS_DIR // set to capture review screenshots
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}

test("search from the desk opens a player report", async ({ page }) => {
  await page.goto("/en")
  await expect(page.getByRole("heading", { name: "Top talent this season" })).toBeVisible()
  const search = page.getByRole("combobox", { name: "Search players" }).first()
  await search.fill("haaland")
  await page.getByRole("option", { name: /Erling Haaland/ }).click()
  await expect(page).toHaveURL(/\/en\/players\/Erling_Haaland/)
  await expect(page.getByRole("heading", { level: 1, name: "Erling Haaland" })).toBeVisible()
  await expect(page.getByText("Scouting verdict")).toBeVisible()
  await expect(page.getByRole("heading", { name: /Plays like Erling Haaland/ })).toBeVisible()
})

test("discover filters by position and budget", async ({ page }) => {
  await page.goto("/en/discover?pos=DF&budget=3")
  await expect(page.getByText(/\d+ players/)).toBeVisible()
  const rows = page.locator("tbody tr")
  await expect(rows.first()).toBeVisible()
  await page.getByRole("tab", { name: "Hidden gems" }).click()
  await expect(page).toHaveURL(/tab=gems/)
  await expect(rows.first()).toBeVisible()
})

test("compare two players on the centre rail", async ({ page }) => {
  await page.goto("/en/compare?a=Erling%20Haaland&b=Harry%20Kane")
  await expect(page.getByText("Talent score").first()).toBeVisible()
  await expect(page.getByRole("link", { name: /Harry Kane/ })).toBeVisible()
})

test("arabic renders right-to-left", async ({ page }) => {
  await page.goto("/ar")
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  await expect(page.getByRole("heading", { name: "مكتب الكشّاف" })).toBeVisible()
})

test("register, save a player, build a list", async ({ page }) => {
  const email = `smoke+${Date.now()}@example.com`
  await page.goto("/en/register")
  await page.getByLabel("Full name").fill("Smoke Scout")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill("Smoke12345!")
  await page.getByRole("radio", { name: "Player agent" }).click()
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/en\/scouting/)
  await expect(page.getByText("Welcome back, Smoke")).toBeVisible()

  // Viewing a report logs a view; saving adds to the shortlist
  await page.goto("/en/players/Hugo_Bueno")
  await expect(page.getByRole("heading", { level: 1, name: "Hugo Bueno" })).toBeVisible()
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByText("Hugo Bueno saved to your shortlist")).toBeVisible()

  await page.goto("/en/scouting")
  await page.getByRole("button", { name: "New list" }).click()
  await page.getByLabel("List name").fill("Left backs U23")
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page.getByRole("link", { name: /Left backs U23/ })).toBeVisible()

  await page.goto("/en/players/Jaouen_Hadjam")
  await page.getByRole("button", { name: "Add to list" }).click()
  await page.getByRole("menuitem", { name: "Left backs U23" }).click()
  await expect(page.getByText("Jaouen Hadjam added to Left backs U23")).toBeVisible()

  await page.goto("/en/scouting")
  await expect(page.getByRole("link", { name: "Hugo Bueno", exact: true })).toBeVisible()
  await expect(page.getByText("Viewed").first()).toBeVisible()
  await shot(page, "scouting")

  await page.getByRole("link", { name: /Left backs U23/ }).click()
  await expect(page.getByRole("link", { name: "Jaouen Hadjam", exact: true })).toBeVisible()
  await shot(page, "list-detail")

  await page.getByRole("button", { name: "Delete" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click()
  await expect(page).toHaveURL(/\/en\/scouting$/)
})
