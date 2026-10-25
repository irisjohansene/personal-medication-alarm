import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Medication } from './types'

const identifier = (medicationId: string, date: Date) => {
  let hash = 0
  for (const char of `${medicationId}-${date.toISOString()}`) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return Math.abs(hash)
}

export async function requestReminderPermission() {
  if (Capacitor.isNativePlatform()) {
    const result = await LocalNotifications.requestPermissions()
    return result.display === 'granted'
  }
  if (!('Notification' in window)) return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export async function scheduleMedicationReminders(medication: Medication) {
  if (!Capacitor.isNativePlatform()) return
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') return

  await cancelMedicationReminders(medication.id)

  const notifications = []
  const now = new Date()
  const firstDay = new Date(`${medication.startDate}T00:00:00`)
  const lastDay = new Date(`${medication.endDate}T23:59:59`)
  const uniqueTimes = new Set<string>()
  for (let day = new Date(Math.max(firstDay.getTime(), now.getTime() - 86_400_000)); day <= lastDay && notifications.length < 60; day.setDate(day.getDate() + 1)) {
    for (const time of medication.times) {
      const [hours, minutes] = time.split(':').map(Number)
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes)
      if (at > now && !uniqueTimes.has(at.toISOString())) {
        uniqueTimes.add(at.toISOString())
        notifications.push({
          id: identifier(medication.id, at),
          title: 'Medication reminder',
          body: `Time to take ${medication.name}${medication.amount ? ` · ${medication.amount}` : ''}`,
          schedule: { at, allowWhileIdle: true },
          extra: { medicationId: medication.id },
        })
      }
    }
  }
  for (const reminder of medication.specificReminders ?? []) {
    const at = new Date(reminder)
    if (at > now && at >= firstDay && at <= lastDay && notifications.length < 60 && !uniqueTimes.has(at.toISOString())) {
      uniqueTimes.add(at.toISOString())
      notifications.push({
        id: identifier(medication.id, at),
        title: 'Medication reminder',
        body: `Time to take ${medication.name}${medication.amount ? ` · ${medication.amount}` : ''}`,
        schedule: { at, allowWhileIdle: true },
        extra: { medicationId: medication.id },
      })
    }
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications })
}

export async function cancelMedicationReminders(medicationId: string) {
  if (!Capacitor.isNativePlatform()) return
  const pending = await LocalNotifications.getPending()
  const matches = pending.notifications.filter((item) => item.extra?.medicationId === medicationId)
  if (matches.length) await LocalNotifications.cancel({ notifications: matches.map(({ id }) => ({ id })) })
}
