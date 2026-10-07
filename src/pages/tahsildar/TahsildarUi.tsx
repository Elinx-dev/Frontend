import { TAHSILDAR_STAGE_TONES } from './tahsildarShared'
import type { TahsildarRecord } from './tahsildarShared'

export function TahsildarStagePill({ record }: { record: Pick<TahsildarRecord, 'stage' | 'stage_label'> }) {
  return <span className={`vao-stage vao-stage-${TAHSILDAR_STAGE_TONES[record.stage] ?? 'waiting'}`}>{record.stage_label}</span>
}
