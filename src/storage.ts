import type { Diagnosis, DoseLog, Medication, Profile, ThemeMode } from './types'

const MEDICATIONS_KEY = 'daily-dose-medications-v1'
const LOGS_KEY = 'daily-dose-logs-v1'
const PROFILE_KEY = 'daily-dose-profile-v1'
const DIAGNOSES_KEY = 'daily-dose-diagnoses-v1'
const THEME_KEY = 'daily-dose-theme-v1'

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
export const loadProfile = () => read<Profile | null>(PROFILE_KEY, null)
export const loadDiagnoses = () => read<Diagnosis[]>(DIAGNOSES_KEY, [])
export const loadTheme = () => read<ThemeMode>(THEME_KEY, 'system')

export function saveMedications(value: Medication[]) {
  localStorage.setItem(MEDICATIONS_KEY, JSON.stringify(value))
}

export function saveLogs(value: DoseLog[]) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(value))
}

export function saveProfile(value: Profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(value))
}

export function saveDiagnoses(value: Diagnosis[]) {
  localStorage.setItem(DIAGNOSES_KEY, JSON.stringify(value))
}

export function saveTheme(value: ThemeMode) {
  localStorage.setItem(THEME_KEY, JSON.stringify(value))
}
