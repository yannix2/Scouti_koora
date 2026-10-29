import { z } from "zod"

// Gateway responses are pandas rows serialized to JSON: fields can be missing, null, or strings.
// Schemas stay loose (extra keys pass through) and coerce what the UI formats.
const num = z.preprocess((v) => (v === null || v === undefined || v === "" ? null : Number(v)), z.number().nullable()).optional()
const str = z.string().nullable().optional()

export const playerRowSchema = z.looseObject({
  Player: z.string(),
  Position: str,
  League: str,
  Squad: str,
  season: str,
  Age: num,
  style_label: str,
  talent_label: str,
  predicted_talent: num,
  market_value_eur: num,
  goals_p90: num,
  assists_p90: num,
  tackles_won_p90: num,
  availability_pct: num,
  similarity_pct: num,
})
export type PlayerRow = z.infer<typeof playerRowSchema>
export const playerRowsSchema = z.array(playerRowSchema)

export const profileSchema = playerRowSchema.extend({
  Nation: str,
  foot: str,
  height_in_cm: num,
  minutes_played: num,
  games_played: num,
  g_a_p90: num,
  shots_p90: num,
  shot_accuracy_pct: num,
  interceptions_p90: num,
  def_actions_p90: num,
  peak_value_eur: num,
  sub_position: str,
})
export type Profile = z.infer<typeof profileSchema>

const axisSchema = z.object({ label: z.string(), value: z.number() })
const categorySchema = z.object({ label: z.string(), icon: z.string().optional(), score: z.number() })

export const radarSchema = z.object({
  player: z.string(),
  axes: z.array(axisSchema),
  categories: z.record(z.string(), categorySchema),
})
export type Radar = z.infer<typeof radarSchema>

export const reportSchema = z.looseObject({
  player: z.string(),
  position: str,
  strengths: z.array(axisSchema),
  weaknesses: z.array(axisSchema),
  value_assessment: z.object({
    market_value_eur: z.number(),
    peak_value_eur: z.number(),
    pct_of_peak: z.number(),
    trend: z.enum(["rising", "stable", "declining"]),
    value_score: z.number(),
  }),
  injury_risk: z.object({
    score: z.number().nullable(),
    label: z.string(),
    total_injuries: z.number(),
    total_days_out: z.number().nullable(),
  }),
  categories: z.record(z.string(), categorySchema),
  info: z.object({
    age: num,
    nation: str,
    squad: str,
    league: str,
    position: str,
    foot: str,
    height: num,
  }),
  stats: z.looseObject({ talent_score: num }),
  profile: z.object({
    score: z.number(),
    band: z.enum(["top_10", "top_25", "above_median", "below_median", "bottom_25"]),
    categories_used: z.array(z.string()),
    cutoffs: z.array(z.number()),
  }),
  minutes_played: z.number(),
  style_label: str,
  overall_verdict: z.string(),
})
export type Report = z.infer<typeof reportSchema>

export const compareSchema = z.object({
  player_a: profileSchema,
  player_b: profileSchema,
  differences: z.record(z.string(), z.number()),
})
export type Comparison = z.infer<typeof compareSchema>

export const trendingSchema = z.array(z.object({ Player: z.string(), view_count: z.number() }))
export type Trending = z.infer<typeof trendingSchema>

// With no history the gateway falls back to hidden gems, so both row shapes are accepted.
export const personalizedSchema = z.array(
  z.looseObject({ Player: z.string(), hybrid_score: num, content_score: num, collab_score: num, Position: str, Squad: str })
)
export type Personalized = z.infer<typeof personalizedSchema>

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["scout", "agent", "club"]),
  avatar_url: z.string().nullable().optional(),
})
export type User = z.infer<typeof userSchema>

export const savedSchema = z.array(
  z.object({ id: z.string(), player_name: z.string(), notes: z.string().nullable(), created_at: z.string() })
)
export type Saved = z.infer<typeof savedSchema>

export const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  is_public: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().optional(),
})
export type ScoutingList = z.infer<typeof listSchema>
export const listsSchema = z.array(listSchema)

export const listItemSchema = z.object({
  id: z.string(),
  list_id: z.string(),
  player_name: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
})
export const listDetailSchema = listSchema.extend({ user_id: z.string(), items: z.array(listItemSchema) })
export type ListDetail = z.infer<typeof listDetailSchema>

export const historySchema = z.array(
  z.object({
    id: z.string(),
    player_name: z.string(),
    interaction_type: z.string(),
    created_at: z.string(),
  })
)
export type History = z.infer<typeof historySchema>

export const stylesSchema = z.array(z.string())
