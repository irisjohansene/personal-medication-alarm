import { useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  Activity, Bell, BellRing, Check, CheckCheck, ChevronRight, CircleHelp, Download,
  Clock3, Plus, Pill, ShieldCheck, Sparkles, X,
} from 'lucide-react'
import { cancelMedicationReminders, requestReminderPermission, scheduleMedicationReminders } from './notifications'
import { loadLogs, loadMedications, saveLogs, saveMedications } from './storage'
import type { Dose, DoseLog, Medication } from './types'

type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const todayISO = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
const formatTime = (time: string) => new Date(`2000-01-01T${time}:00`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' })
const doseKey = (medicationId: string, day: string, time: string) => `${medicationId}|${day}|${time}`
const timeLabel = (time: string) => {
  const hour = Number(time.slice(0, 2))
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}

function App() {
  const [medications, setMedications] = useState<Medication[]>(loadMedications)
  const [logs, setLogs] = useState<DoseLog[]>(loadLogs)
  const [showForm, setShowForm] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    Capacitor.isNativePlatform() ? 'default' : 'Notification' in window ? Notification.permission : 'unsupported',
  )
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [showIosInstall, setShowIosInstall] = useState(false)
  const [notice, setNotice] = useState('')
  const today = todayISO()

  useEffect(() => saveMedications(medications), [medications])
  useEffect(() => saveLogs(logs), [logs])

  useEffect(() => {
    const onInstallAvailable = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', onInstallAvailable)
    const appleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    setShowIosInstall(appleMobile && !window.matchMedia('(display-mode: standalone)').matches)
    return () => window.removeEventListener('beforeinstallprompt', onInstallAvailable)
  }, [])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    void import('@capacitor/local-notifications').then(({ LocalNotifications }) =>
      LocalNotifications.checkPermissions().then((result) => setPermission(result.display === 'granted' ? 'granted' : result.display === 'denied' ? 'denied' : 'default')),
    )
  }, [])

  useEffect(() => {
    for (const medication of medications) void scheduleMedicationReminders(medication)
  }, [])

  const todayDoses = useMemo<Dose[]>(() => medications
    .filter((med) => med.startDate <= today && med.endDate >= today)
    .flatMap((medication) => medication.times.map((time) => {
      const key = doseKey(medication.id, today, time)
      const log = logs.find((entry) => entry.id === key)
      const [hours, minutes] = time.split(':').map(Number)
      const scheduledAt = new Date()
      scheduledAt.setHours(hours, minutes, 0, 0)
      return { key, medication, time, scheduledAt, status: log?.status }
    }))
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()), [medications, today, logs])

  const completedCount = todayDoses.filter((dose) => dose.status === 'taken').length
  const pendingCount = todayDoses.filter((dose) => !dose.status).length
  const nextDose = todayDoses.find((dose) => !dose.status && dose.scheduledAt >= new Date())
  const activeMeds = medications.filter((med) => med.startDate <= today && med.endDate >= today)

  useEffect(() => {
    if (Capacitor.isNativePlatform() || permission !== 'granted' || !('Notification' in window)) return
    const sendDueNotifications = () => {
      if (document.visibilityState !== 'visible') return
      const now = new Date()
      for (const dose of todayDoses) {
        const minuteKey = `${dose.key}|web-notified`
        if (!dose.status && dose.scheduledAt.getHours() === now.getHours() && dose.scheduledAt.getMinutes() === now.getMinutes() && !localStorage.getItem(minuteKey)) {
          new Notification('Medication reminder', { body: `Time to take ${dose.medication.name}` })
          localStorage.setItem(minuteKey, '1')
        }
      }
    }
    sendDueNotifications()
    const timer = window.setInterval(sendDueNotifications, 30_000)
    return () => window.clearInterval(timer)
  }, [todayDoses, permission])

  async function enableReminders() {
    const granted = await requestReminderPermission()
    setPermission(granted ? 'granted' : Capacitor.isNativePlatform() ? 'denied' : 'Notification' in window ? Notification.permission : 'unsupported')
    setNotice(granted ? 'Reminders enabled on this device.' : 'Notifications are off. You can enable them in device or browser settings.')
    window.setTimeout(() => setNotice(''), 4500)
    if (granted) for (const medication of medications) void scheduleMedicationReminders(medication)
  }

  async function installApp() {
    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      setInstallPrompt(null)
      setNotice(choice.outcome === 'accepted' ? 'Daily Dose was added to your home screen.' : 'You can install Daily Dose later from your browser menu.')
    } else {
      setNotice('In Safari, tap Share, then Add to Home Screen.')
    }
    window.setTimeout(() => setNotice(''), 4500)
  }

  function recordDose(dose: Dose, status: 'taken' | 'skipped') {
    if (dose.status) return
    setLogs((current) => [{
      id: dose.key,
      medicationId: dose.medication.id,
      scheduledAt: dose.scheduledAt.toISOString(),
      status,
      recordedAt: new Date().toISOString(),
    }, ...current])
  }

  function addMedication(input: Omit<Medication, 'id' | 'createdAt'>) {
    const medication: Medication = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    setMedications((current) => [...current, medication])
    setShowForm(false)
    void scheduleMedicationReminders(medication)
    setNotice('Medication added to your schedule.')
    window.setTimeout(() => setNotice(''), 3500)
  }

  async function removeMedication(medication: Medication) {
    if (!window.confirm(`Remove ${medication.name} and its scheduled reminders?`)) return
    setMedications((current) => current.filter((item) => item.id !== medication.id))
    await cancelMedicationReminders(medication.id)
  }

  const recentLogs = logs.slice(0, 6)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="Daily Dose home"><span className="brand-mark"><Pill size={21} /></span><span>daily<span className="brand-light">dose</span></span></a>
        <div className="side-caption">YOUR SPACE</div>
        <a className="nav-item active" href="#home"><Activity size={18} />Overview</a>
        <a className="nav-item" href="#medications"><Pill size={18} />My medications<span className="nav-count">{activeMeds.length}</span></a>
        <a className="nav-item" href="#history"><CheckCheck size={18} />Dose history</a>
        <div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck size={19} /><div><strong>Your data stays yours</strong><p>Saved privately on this device.</p></div></div><div className="side-footer">A little help, right on time.</div></div>
      </aside>

      <main className="main-content" id="home">
        <header className="topbar"><div className="mobile-brand"><span className="brand-mark"><Pill size={19} /></span><b>daily<span className="brand-light">dose</span></b></div><div className="today-chip"><span className="today-dot" />TODAY <b>{new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</b></div>{(installPrompt || showIosInstall) && <button className="install-button" onClick={() => void installApp()}><Download size={15} />Install</button>}<button className="icon-button" aria-label="Enable reminders" onClick={enableReminders}><Bell size={19} />{permission === 'granted' && <i />}</button></header>

        <div className="page-wrap">
          <section className="greeting-row"><div><div className="eyebrow"><Sparkles size={14} /> YOUR DAILY WELLNESS</div><h1>A gentler way to<br className="mobile-break" /> stay on track.</h1><p className="lead">Your medication routine, all in one calm place.</p></div><button className="primary-button" onClick={() => setShowForm(true)}><Plus size={18} /> Add medication</button></section>

          <section className="summary-grid" aria-label="Today's summary">
            <div className="summary-card summary-main"><div className="summary-heading"><div><span className="summary-label">TODAY'S PROGRESS</span><h2>{pendingCount ? `${pendingCount} dose${pendingCount === 1 ? '' : 's'} to go` : todayDoses.length ? 'All caught up' : 'A fresh start'}</h2></div><div className="progress-icon"><CheckCheck size={21} /></div></div><div className="progress-track"><span style={{ width: `${todayDoses.length ? (completedCount / todayDoses.length) * 100 : 0}%` }} /></div><div className="progress-caption"><span>{completedCount} of {todayDoses.length} doses taken</span><span>{todayDoses.length ? Math.round((completedCount / todayDoses.length) * 100) : 0}%</span></div></div>
            <div className="summary-card next-card"><span className="summary-label">UP NEXT</span>{nextDose ? <><div className="next-time">{formatTime(nextDose.time)}</div><div className="next-name">{nextDose.medication.name}</div><span className="next-tag"><Clock3 size={13} /> {timeLabel(nextDose.time)}</span></> : <><div className="next-time">—</div><div className="next-name">Nothing scheduled</div><span className="next-tag">Enjoy the moment</span></>}</div>
          </section>

          {permission !== 'granted' && <button className="reminder-banner" onClick={enableReminders}><span className="reminder-banner-icon"><BellRing size={19} /></span><span><strong>Turn on medication reminders</strong><small>In the web app, reminders work while this page stays open.</small></span><ChevronRight size={18} /></button>}

          <section className="section-block" aria-labelledby="today-heading"><div className="section-heading"><div><span className="eyebrow muted">YOUR PLAN</span><h2 id="today-heading">Today's schedule</h2></div><span className="section-meta">{todayDoses.length} {todayDoses.length === 1 ? 'dose' : 'doses'}</span></div>
            {todayDoses.length ? <div className="dose-list">{todayDoses.map((dose, index) => <DoseRow key={dose.key} dose={dose} first={index === 0} last={index === todayDoses.length - 1} onRecord={recordDose} />)}</div> : <div className="empty-card"><div className="empty-icon"><Pill size={23} /></div><div><h3>No doses on the calendar</h3><p>Add a medication and its schedule to see reminders here.</p></div><button className="text-button" onClick={() => setShowForm(true)}>Add one <ChevronRight size={16} /></button></div>}
          </section>

          <section className="section-block medication-section" id="medications"><div className="section-heading"><div><span className="eyebrow muted">YOUR ROUTINE</span><h2>Current medications</h2></div><button className="subtle-button" onClick={() => setShowForm(true)}><Plus size={16} /> Add new</button></div>
            {activeMeds.length ? <div className="medication-grid">{activeMeds.map((medication) => <article className="med-card" key={medication.id}><div className="med-card-top"><div className="med-icon"><Pill size={18} /></div><button className="remove-button" aria-label={`Remove ${medication.name}`} onClick={() => void removeMedication(medication)}><X size={16} /></button></div><h3>{medication.name}</h3><p className="med-amount">{[medication.amount, medication.form].filter(Boolean).join(' · ') || medication.category}</p><div className="med-card-divider" /><div className="med-meta"><span><Clock3 size={14} />{medication.times.map(formatTime).join(', ')}</span><span>Until {formatDate(medication.endDate)}</span></div>{medication.instructions && <p className="med-instructions">{medication.instructions}</p>}</article>)}</div> : <div className="small-empty">Your medication list is empty. Add a medication to begin.</div>}
          </section>

          <section className="section-block history-section" id="history"><div className="section-heading"><div><span className="eyebrow muted">RECENT ACTIVITY</span><h2>Dose history</h2></div><CircleHelp size={18} className="help-icon" /></div>
            {recentLogs.length ? <div className="history-card">{recentLogs.map((log) => { const med = medications.find((item) => item.id === log.medicationId); return <div className="history-row" key={`${log.id}-${log.recordedAt}`}><div className={`history-status ${log.status}`}><Check size={15} /></div><div className="history-med"><strong>{med?.name ?? 'Medication'}</strong><span>{new Date(log.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(log.scheduledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div><span className={`history-label ${log.status}`}>{log.status === 'taken' ? 'Taken' : 'Skipped'}</span></div> })}</div> : <div className="small-empty">Your dose history will appear here after you log a dose.</div>}
          </section>
          <footer className="app-footer"><ShieldCheck size={15} /> Your medication information is stored on this device. Daily Dose does not provide medical advice.</footer>
        </div>
      </main>

      {notice && <div className="toast" role="status">{notice}</div>}
      {showForm && <MedicationForm onClose={() => setShowForm(false)} onSave={addMedication} />}
    </div>
  )
}

function DoseRow({ dose, first, last, onRecord }: { dose: Dose; first: boolean; last: boolean; onRecord: (dose: Dose, status: 'taken' | 'skipped') => void }) {
  const isPast = !dose.status && dose.scheduledAt < new Date()
  return <article className={`dose-row ${dose.status ? 'dose-done' : ''}`}><div className="dose-time"><span className="dose-time-text">{formatTime(dose.time)}</span><span className={`timeline ${first ? 'first' : ''} ${last ? 'last' : ''} ${dose.status === 'taken' ? 'filled' : ''}`}><i /></span></div><div className="dose-card"><div className={`dose-symbol ${dose.status === 'taken' ? 'done' : ''}`}><Pill size={18} /></div><div className="dose-details"><div className="dose-name">{dose.medication.name}</div><div className="dose-subtitle">{[dose.medication.amount, dose.medication.form, timeLabel(dose.time)].filter(Boolean).join(' · ')}</div></div>{dose.status ? <span className={`dose-status ${dose.status}`}>{dose.status === 'taken' ? <><Check size={14} /> Taken</> : 'Skipped'}</span> : <div className="dose-actions"><button className="skip-button" onClick={() => onRecord(dose, 'skipped')}>Skip</button><button className="taken-button" onClick={() => onRecord(dose, 'taken')}><Check size={15} /> Take</button></div>}{isPast && <span className="overdue-label">Due earlier</span>}</div></article>
}

function MedicationForm({ onClose, onSave }: { onClose: () => void; onSave: (input: Omit<Medication, 'id' | 'createdAt'>) => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [form, setForm] = useState('')
  const [category, setCategory] = useState('Medication')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [times, setTimes] = useState(['08:00'])
  const [instructions, setInstructions] = useState('')
  const [error, setError] = useState('')

  function changeTime(index: number, value: string) { setTimes((current) => current.map((time, i) => i === index ? value : time)) }
  function save(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Enter the medication name.')
    if (endDate < startDate) return setError('The end date must be on or after the start date.')
    onSave({ name: name.trim(), amount: amount.trim(), form, category, startDate, endDate, times: [...new Set(times)].sort(), instructions: instructions.trim() })
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title"><div className="modal-header"><div><span className="eyebrow muted">BUILD YOUR ROUTINE</span><h2 id="form-title">Add medication</h2></div><button className="icon-button close-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div><form onSubmit={save}><label className="field-label">Medication name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vitamin D" /></label><div className="form-two"><label className="field-label">Strength / amount<input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500 mg" /></label><label className="field-label">Form<select value={form} onChange={(e) => setForm(e.target.value)}><option value="">Select form</option><option>Tablet</option><option>Capsule</option><option>Liquid</option><option>Drop</option><option>Inhaler</option><option>Other</option></select></label></div><div className="form-two"><label className="field-label">Category<select value={category} onChange={(e) => setCategory(e.target.value)}><option>Medication</option><option>Vitamin</option><option>Supplement</option><option>Maintenance</option><option>Other</option></select></label><label className="field-label">Times per day<select value={String(times.length)} onChange={(e) => { const count = Number(e.target.value); setTimes((current) => Array.from({ length: count }, (_, i) => current[i] ?? ['08:00', '14:00', '20:00', '23:00'][i])) }}><option value="1">Once a day</option><option value="2">Twice a day</option><option value="3">3 times a day</option><option value="4">4 times a day</option></select></label></div><div className="time-fields">{times.map((time, index) => <label className="field-label" key={index}>{times.length === 1 ? 'Reminder time' : `Dose ${index + 1} time`}<input type="time" value={time} onChange={(e) => changeTime(index, e.target.value)} /></label>)}</div><div className="form-two"><label className="field-label">Start date<input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value) }} required /></label><label className="field-label">End date<input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required /></label></div><label className="field-label">Personal note <span className="optional">Optional</span><textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="A note for yourself, such as 'with food'" rows={2} /></label>{error && <p className="form-error">{error}</p>}<div className="form-note"><ShieldCheck size={16} /> Enter the schedule from your prescription or clinician.</div><div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Plus size={17} /> Add to schedule</button></div></form></section></div>
}

export default App
