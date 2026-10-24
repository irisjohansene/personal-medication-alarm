export type Medication = {
  id: string
  name: string
  amount: string
  form: string
  category: string
  startDate: string
  endDate: string
  times: string[]
  instructions: string
  createdAt: string
}

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
