import type { Row } from '../types'

export interface ScheduleSurveyForm {
  surveyNo: string
  subdivisionNo: string
  value: string
}

export interface ScheduleForm {
  label: string
  value: string
  surveys: ScheduleSurveyForm[]
}

const scheduleLetter = (index: number) => `Schedule ${String.fromCharCode(65 + (index % 26))}`

export const emptySchedule = (index: number): ScheduleForm => ({ label: scheduleLetter(index), value: '', surveys: [] })

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value))

export const schedulesFromRows = (rows: unknown): ScheduleForm[] =>
  (Array.isArray(rows) ? (rows as Row[]) : []).map((row) => ({
    label: text(row.label),
    value: text(row.manual_value),
    surveys: (Array.isArray(row.surveys) ? (row.surveys as Row[]) : []).map((survey) => ({
      surveyNo: text(survey.survey_no),
      subdivisionNo: text(survey.subdivision_no),
      value: text(survey.value),
    })),
  }))

/** Mirrors the backend: survey-level values, when any are entered, make up the schedule value. */
export const scheduleTotal = (schedule: ScheduleForm) => {
  const surveyValues = schedule.surveys.filter((survey) => survey.value.trim().length > 0)
  if (surveyValues.length > 0) return surveyValues.reduce((sum, survey) => sum + Number(survey.value), 0)
  return schedule.value.trim().length > 0 ? Number(schedule.value) : 0
}

export const schedulePayload = (schedules: ScheduleForm[]) =>
  schedules.map((schedule) => ({
    label: schedule.label.trim(),
    value: schedule.value.trim().length > 0 ? Number(schedule.value) : undefined,
    surveys: schedule.surveys.map((survey) => ({
      surveyNo: survey.surveyNo.trim(),
      subdivisionNo: survey.subdivisionNo.trim() || undefined,
      value: survey.value.trim().length > 0 ? Number(survey.value) : undefined,
    })),
  }))

export const validateSchedules = (schedules: ScheduleForm[]): string | null => {
  if (schedules.length === 0) return 'Add at least one schedule with its value.'
  const labels = new Set<string>()
  for (const schedule of schedules) {
    const label = schedule.label.trim()
    if (label.length === 0) return 'Every schedule needs a name, e.g. Schedule A.'
    if (labels.has(label.toUpperCase())) return `${label} is entered twice.`
    labels.add(label.toUpperCase())
    if (schedule.surveys.some((survey) => survey.surveyNo.trim().length === 0)) {
      return `Enter the survey number for each line in ${label}.`
    }
    if (!(scheduleTotal(schedule) > 0)) return `Enter a value above zero for ${label}.`
  }
  return null
}

/** Relationship categories from the Fee Relationship Category master that apply to the transaction type. */
export const relationshipCategoryOptions = (categories: Row[] | undefined, transactionType: string) =>
  (categories ?? [])
    .filter((category) => String(category.transaction_types ?? '').split(',').includes(transactionType))
    .map((category) => ({ value: String(category.code), label: String(category.label ?? category.code) }))

export const today = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

/** Payment date as an offset timestamp: today means now, a past date means that day's midnight locally. */
export const paidAtFrom = (date: string) =>
  date.length === 0 || date === today() ? undefined : new Date(`${date}T00:00:00`).toISOString()
