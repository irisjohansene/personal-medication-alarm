import type { DoseLog, Medication } from './types'

const MEDICATIONS_KEY = 'daily-dose-medications-v1'
const LOGS_KEY = 'daily-dose-logs-v1'

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

export const loadMedications = () => read<Medication[]>(MEDICATIONS_KEY, [])
export const loadLogs = () => read<DoseLog[]>(LOGS_KEY, [])

export function saveMedications(value: Medication[]) {
  localStorage.setItem(MEDICATIONS_KEY, JSON.stringify(value))
}

export function saveLogs(value: DoseLog[]) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(value))
}
