export type LifestyleAnswers = {
  sleep_hours?: number | null
  stress_level?: number | null
  sunscreen_days_per_week?: number | null
  smoking?: boolean | null
}

export type AnalysisAnswers = {
  age?: number | null
  sex?: string | null
  concerns: string[]
  goals: string[]
  lifestyle?: LifestyleAnswers | null
}

export type MetricResult = {
  id: string
  label: string
  severity: number
  confidence: number
  summary: string
  tips: string[]
  value?: number | null
  unit?: string | null
}

export type RoutineStep = {
  time: string
  step: string
  why: string
}

export type ImageQuality = {
  score: number
  brightness: number
  blur: number
  face_found: boolean
  face_coverage: number
  warnings: string[]
}

export type AnalysisResponse = {
  analysis_id: string
  selected_image: number
  overall_score: number
  skin_type: string
  estimated_fitzpatrick: number | null
  skin_age: number | null
  skin_age_delta: number | null
  metrics: MetricResult[]
  heatmaps?: Record<string, string> | null
  quality: ImageQuality
  routine: RoutineStep[]
  notes: string[]
  debug?: Record<string, unknown> | null
}

export type ChatTurn = {
  role: 'user' | 'model'
  text: string
}

export type DoctorChatResponse = {
  reply: string
}

export type StoredAnalysis = {
  id: string
  createdAt: string
  thumb?: string
  response: AnalysisResponse
}
