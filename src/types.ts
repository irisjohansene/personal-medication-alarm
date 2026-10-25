export type Medication = {
  id: string
  name: string
  amount: string
  form: string
  category: string
  startDate: string
  endDate: string
  times: string[]
  frequency?: string
  frequencyOther?: string
  diagnosisId?: string
  specificReminders?: string[]
  instructions: string
  createdAt: string
}

export type Profile = {
  name: string
  sex: string
  birthday: string
  nationality: string
  status: string
  contactNumber: string
  homeAddress: string
  emailAddress: string
}

export type Diagnosis = {
  id: string
  name: string
  notes: string
  createdAt: string
}

export type ThemeMode = 'light' | 'dark' | 'system'

export type DoseLog = {
  id: string
  medicationId: string
  scheduledAt: string
  status: 'taken' | 'skipped'
  recordedAt: string
}

export type Dose = {
  key: string
  medication: Medication
  time: string
  scheduledAt: Date
  status?: DoseLog['status']
}
