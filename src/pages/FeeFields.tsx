import type { Row } from '../types'
import { DataTable, Field, formatCell } from '../ui'
import { emptySchedule, scheduleTotal, type ScheduleForm, type ScheduleSurveyForm } from './feeShared'

const money = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 2 })

export function ScheduleEditor({
  schedules,
  onChange,
  readOnly = false,
}: {
  schedules: ScheduleForm[]
  onChange: (schedules: ScheduleForm[]) => void
  readOnly?: boolean
}) {
  const update = (index: number, patch: Partial<ScheduleForm>) =>
    onChange(schedules.map((schedule, i) => (i === index ? { ...schedule, ...patch } : schedule)))
  const updateSurvey = (index: number, surveyIndex: number, patch: Partial<ScheduleSurveyForm>) =>
    update(index, {
      surveys: schedules[index].surveys.map((survey, i) => (i === surveyIndex ? { ...survey, ...patch } : survey)),
    })
  const grandTotal = schedules.reduce((sum, schedule) => sum + scheduleTotal(schedule), 0)
  return (
    <section className="form-section">
      <h3>Schedule values</h3>
      <p className="helper">
        Fees are calculated for each schedule separately. Enter the value of each schedule, or the value of each survey
        number in it and the schedule value is totalled automatically.
      </p>
      {schedules.map((schedule, index) => {
        const surveyValuesEntered = schedule.surveys.some((survey) => survey.value.trim().length > 0)
        return (
          <div className="party-group" key={index}>
            <div className="row">
              <Field label="Schedule" value={schedule.label} onChange={(value) => update(index, { label: value })} readOnly={readOnly} required />
              <Field
                label="Schedule value (₹)"
                value={surveyValuesEntered ? String(scheduleTotal(schedule)) : schedule.value}
                onChange={(value) => update(index, { value })}
                type="number"
                readOnly={readOnly || surveyValuesEntered}
                required
              />
              {readOnly ? null : (
                <button type="button" className="outline" onClick={() => onChange(schedules.filter((_, i) => i !== index))}>
                  Remove schedule
                </button>
              )}
            </div>
            {schedule.surveys.map((survey, surveyIndex) => (
              <div className="row" key={surveyIndex}>
                <Field label="Survey no." value={survey.surveyNo} onChange={(value) => updateSurvey(index, surveyIndex, { surveyNo: value })} readOnly={readOnly} required />
                <Field label="Subdivision no." value={survey.subdivisionNo} onChange={(value) => updateSurvey(index, surveyIndex, { subdivisionNo: value })} readOnly={readOnly} />
                <Field label="Survey value (₹)" value={survey.value} onChange={(value) => updateSurvey(index, surveyIndex, { value })} type="number" readOnly={readOnly} />
                {readOnly ? null : (
                  <button
                    type="button"
                    className="outline"
                    onClick={() => update(index, { surveys: schedule.surveys.filter((_, i) => i !== surveyIndex) })}
                  >
                    Remove survey
                  </button>
                )}
              </div>
            ))}
            {readOnly ? null : (
              <button
                type="button"
                className="outline"
                onClick={() => update(index, { surveys: [...schedule.surveys, { surveyNo: '', subdivisionNo: '', value: '' }] })}
              >
                + Add survey number
              </button>
            )}
          </div>
        )
      })}
      <div className="row">
        {readOnly ? null : (
          <button type="button" className="outline" onClick={() => onChange([...schedules, emptySchedule(schedules.length)])}>
            + Add schedule
          </button>
        )}
        <span className="grow">
          Total value of all schedules: <b>₹{money(grandTotal)}</b>
        </span>
      </div>
    </section>
  )
}

interface ChargeLine {
  label?: string
  basis?: string
  rate?: number
  pages?: number | null
  amount?: number
}

const parseInput = (fee: Row): Row => {
  const raw = fee.calculation_input_json
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Row
    } catch {
      return {}
    }
  }
  return raw !== null && typeof raw === 'object' ? (raw as Row) : {}
}

export function FeeSummary({ fee, scheduleLines }: { fee: Row; scheduleLines: Row[] }) {
  const input = parseInput(fee)
  const chargeLines = Array.isArray(input.otherChargeLines) ? (input.otherChargeLines as ChargeLine[]) : []
  const scheduleBased = fee.valuation_basis_used === 'SCHEDULE_VALUE'
  return (
    <>
      {scheduleBased && scheduleLines.length > 0 ? (
        <DataTable
          rows={scheduleLines}
          columns={[
            { key: 'schedule_label', label: 'Schedule' },
            { key: 'schedule_value', label: 'Schedule value' },
            { key: 'stamp_duty', label: 'Stamp duty' },
            { key: 'registration_fee', label: 'Registration fee' },
          ]}
        />
      ) : null}
      <dl className="kv">
        <dt>{scheduleBased ? 'Total value of all schedules' : 'Applicable value'}</dt>
        <dd>{formatCell(fee.valuation_amount)}</dd>
        <dt>Stamp duty</dt>
        <dd>{formatCell(fee.stamp_duty)}</dd>
        <dt>Registration fee</dt>
        <dd>{formatCell(fee.registration_fee)}</dd>
        <dt>TDS</dt>
        <dd>{formatCell(fee.tds_amount)}</dd>
        <dt>Other charges</dt>
        <dd>
          {formatCell(fee.other_charges)}
          {chargeLines.length > 0 ? (
            <small className="muted">
              {' '}
              (
              {chargeLines
                .map((line) =>
                  line.basis === 'PER_PAGE'
                    ? `${line.label ?? ''} ${formatCell(line.rate)} × ${formatCell(line.pages)} pages = ${formatCell(line.amount)}`
                    : `${line.label ?? ''} ${formatCell(line.amount)}`,
                )
                .join('; ')}
              )
            </small>
          ) : null}
        </dd>
        <dt>Survey fee</dt>
        <dd>{formatCell(fee.survey_fee ?? 0)}</dd>
        <dt>Total fee payable</dt>
        <dd>
          <b>{formatCell(fee.total_payable)}</b>
        </dd>
      </dl>
    </>
  )
}

