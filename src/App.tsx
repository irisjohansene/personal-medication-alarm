import { useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  Activity, Bell, BellRing, Check, CheckCheck, ChevronRight, CircleHelp, Download,
  Clock3, Plus, Pill, ShieldCheck, Sparkles, UserRound, X,
} from 'lucide-react'
import { cancelMedicationReminders, requestReminderPermission, scheduleMedicationReminders } from './notifications'
import { loadDiagnoses, loadLogs, loadMedications, loadProfile, loadTheme, saveDiagnoses, saveLogs, saveMedications, saveProfile, saveTheme } from './storage'
import { ProfileEditor, ProfileRegistration } from './registration'
import { DiagnosisEditor, DiagnosisSection } from './diagnoses'
import { MedicationForm } from './medication-form'
import type { Diagnosis, Dose, DoseLog, Medication, Profile, ThemeMode } from './types'

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
const ageFromBirthday = (birthday: string) => {
  const birth = new Date(`${birthday}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return 0
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1
  return Math.max(age, 0)
}
const doseKey = (medicationId: string, day: string, time: string, once = false) => `${medicationId}|${day}|${once ? 'once|' : ''}${time}`
const timeLabel = (time: string) => {
  const hour = Number(time.slice(0, 2))
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}

function App() {
  const [medications, setMedications] = useState<Medication[]>(loadMedications)
  const [logs, setLogs] = useState<DoseLog[]>(loadLogs)
  const [profile, setProfile] = useState<Profile | null>(loadProfile)
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>(loadDiagnoses)
  const [theme, setTheme] = useState<ThemeMode>(loadTheme)
  const [editingProfile, setEditingProfile] = useState(false)
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false)
  const [editingDiagnosis, setEditingDiagnosis] = useState<Diagnosis | null>(null)
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
  useEffect(() => saveDiagnoses(diagnoses), [diagnoses])
  useEffect(() => { if (profile) saveProfile(profile) }, [profile])
  useEffect(() => { saveTheme(theme); document.documentElement.dataset.theme = theme }, [theme])

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
    .flatMap((medication) => {
      const alarms = [
        ...(medication.times ?? []).map((time) => ({ time, localDateTime: `${today}T${time}`, once: false })),
        ...(medication.specificReminders ?? []).filter((value) => value.slice(0, 10) === today).map((value) => ({ time: value.slice(11, 16), localDateTime: value, once: true })),
      ]
      const seen = new Set<string>()
      return alarms.flatMap(({ time, localDateTime, once }) => {
        const unique = `${time}|${localDateTime}`
        if (!time || seen.has(unique)) return []
        seen.add(unique)
        const key = doseKey(medication.id, today, time, once)
        const log = logs.find((entry) => entry.id === key)
        return [{ key, medication, time, scheduledAt: new Date(`${localDateTime}:00`), status: log?.status }]
      })
    })
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

  function saveDiagnosis(input: { name: string; notes: string }) {
    if (editingDiagnosis) {
      setDiagnoses((current) => current.map((item) => item.id === editingDiagnosis.id ? { ...item, ...input } : item))
      setNotice('Diagnosis updated.')
    } else {
      setDiagnoses((current) => [...current, { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }])
      setNotice('Diagnosis saved on this device.')
    }
    setShowDiagnosisForm(false)
    setEditingDiagnosis(null)
  }

  async function removeMedication(medication: Medication) {
    if (!window.confirm(`Remove ${medication.name} and its scheduled reminders?`)) return
    setMedications((current) => current.filter((item) => item.id !== medication.id))
    await cancelMedicationReminders(medication.id)
  }

  const recentLogs = logs.slice(0, 6)

  if (!profile) return <ProfileRegistration onSave={setProfile} theme={theme} onThemeChange={setTheme} />

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="Daily Dose home"><span className="brand-mark"><Pill size={21} /></span><span>daily<span className="brand-light">dose</span></span></a>
        <div className="side-caption">YOUR SPACE</div>
        <a className="nav-item active" href="#home"><Activity size={18} />Overview</a>
        <a className="nav-item" href="#medications"><Pill size={18} />My medications<span className="nav-count">{activeMeds.length}</span></a>
        <a className="nav-item" href="#health"><ShieldCheck size={18} />Health details</a>
        <a className="nav-item" href="#history"><CheckCheck size={18} />Dose history</a>
        <div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck size={19} /><div><strong>Your data stays yours</strong><p>Saved privately on this device.</p></div></div><div className="side-footer">A little help, right on time.</div></div>
      </aside>

      <main className="main-content" id="main-content" tabIndex={-1}>
        <header className="topbar"><div className="mobile-brand"><span className="brand-mark"><Pill size={19} aria-hidden="true" /></span><b>daily<span className="brand-light">dose</span></b></div><div className="today-chip"><span className="today-dot" aria-hidden="true" />TODAY <b>{new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</b></div><label className="theme-control"><span className="theme-control-label">Theme</span><select aria-label="Color theme" value={theme} onChange={(event) => setTheme(event.target.value as ThemeMode)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>{(installPrompt || showIosInstall) && <button className="install-button" onClick={() => void installApp()}><Download size={15} aria-hidden="true" />Install</button>}<button className="icon-button" aria-label="Enable medication reminders" onClick={() => void enableReminders()}><Bell size={19} aria-hidden="true" />{permission === 'granted' && <i aria-label="Reminders enabled" />}</button><button className="profile-button" onClick={() => setEditingProfile(true)} aria-label="Edit personal profile"><UserRound size={16} aria-hidden="true" /><span>{profile.name.split(' ')[0]}</span></button></header>

        <div className="page-wrap" id="home">
          <section className="greeting-row"><div><div className="eyebrow"><Sparkles size={14} aria-hidden="true" /> YOUR DAILY WELLNESS</div><h1>Welcome back, {profile.name.split(' ')[0]}.</h1><p className="lead">Your medication routine, all in one calm place.</p></div><button className="primary-button" onClick={() => setShowForm(true)}><Plus size={18} aria-hidden="true" /> Add medication</button></section>

          <section className="summary-grid" aria-label="Today's summary">
          <div className="summary-card summary-main"><div className="summary-heading"><div><span className="summary-label">TODAY'S PROGRESS</span><h2>{pendingCount ? `${pendingCount} dose${pendingCount === 1 ? '' : 's'} to go` : todayDoses.length ? 'All caught up' : 'A fresh start'}</h2></div><div className="progress-icon"><CheckCheck size={21} aria-hidden="true" /></div></div><div className="progress-track" role="progressbar" aria-label="Doses taken today" aria-valuemin={0} aria-valuemax={todayDoses.length || 1} aria-valuenow={completedCount}><span style={{ width: `${todayDoses.length ? (completedCount / todayDoses.length) * 100 : 0}%` }} /></div><div className="progress-caption"><span>{completedCount} of {todayDoses.length} doses taken</span><span>{todayDoses.length ? Math.round((completedCount / todayDoses.length) * 100) : 0}%</span></div></div>
            <div className="summary-card next-card"><span className="summary-label">UP NEXT</span>{nextDose ? <><div className="next-time">{formatTime(nextDose.time)}</div><div className="next-name">{nextDose.medication.name}</div><span className="next-tag"><Clock3 size={13} /> {timeLabel(nextDose.time)}</span></> : <><div className="next-time">—</div><div className="next-name">Nothing scheduled</div><span className="next-tag">Enjoy the moment</span></>}</div>
          </section>

          {permission !== 'granted' && <button className="reminder-banner" onClick={enableReminders}><span className="reminder-banner-icon"><BellRing size={19} /></span><span><strong>Turn on medication reminders</strong><small>In the web app, reminders work while this page stays open.</small></span><ChevronRight size={18} /></button>}

          <section className="section-block" aria-labelledby="today-heading"><div className="section-heading"><div><span className="eyebrow muted">YOUR PLAN</span><h2 id="today-heading">Today's schedule</h2></div><span className="section-meta">{todayDoses.length} {todayDoses.length === 1 ? 'dose' : 'doses'}</span></div>
            {todayDoses.length ? <div className="dose-list">{todayDoses.map((dose, index) => <DoseRow key={dose.key} dose={dose} first={index === 0} last={index === todayDoses.length - 1} onRecord={recordDose} />)}</div> : <div className="empty-card"><div className="empty-icon"><Pill size={23} /></div><div><h3>No doses on the calendar</h3><p>Add a medication and its schedule to see reminders here.</p></div><button className="text-button" onClick={() => setShowForm(true)}>Add one <ChevronRight size={16} /></button></div>}
          </section>

          <section className="section-block medication-section" id="medications"><div className="section-heading"><div><span className="eyebrow muted">YOUR ROUTINE</span><h2>Current medications</h2></div><button className="subtle-button" onClick={() => setShowForm(true)}><Plus size={16} /> Add new</button></div>
            {activeMeds.length ? <div className="medication-grid">{activeMeds.map((medication) => { const diagnosis = diagnoses.find((item) => item.id === medication.diagnosisId); return <article className="med-card" key={medication.id}><div className="med-card-top"><div className="med-icon"><Pill size={18} aria-hidden="true" /></div><button className="remove-button" aria-label={`Remove ${medication.name}`} onClick={() => void removeMedication(medication)}><X size={16} aria-hidden="true" /></button></div><h3>{medication.name}</h3><p className="med-amount">{[medication.amount, medication.form].filter(Boolean).join(' · ') || medication.category}</p><div className="med-card-divider" /><div className="med-meta"><span><Clock3 size={14} aria-hidden="true" />{medication.times.map(formatTime).join(', ')}</span><span>Until {formatDate(medication.endDate)}</span></div>{diagnosis && <p className="med-diagnosis">For {diagnosis.name}</p>}{medication.instructions && <p className="med-instructions">{medication.instructions}</p>}</article> })}</div> : <div className="small-empty">Your medication list is empty. Add a medication to begin.</div>}
          </section>

          <section className="section-block profile-summary" aria-labelledby="personal-heading"><div className="section-heading"><div><span className="eyebrow muted">YOUR DETAILS</span><h2 id="personal-heading">Personal information</h2></div><button className="subtle-button" onClick={() => setEditingProfile(true)}>Edit profile</button></div><details><summary>{profile.name} · {profile.sex} · {ageFromBirthday(profile.birthday)} years old</summary><dl className="profile-details"><div><dt>Birthday</dt><dd>{formatDate(profile.birthday)}</dd></div><div><dt>Nationality</dt><dd>{profile.nationality}</dd></div><div><dt>Status</dt><dd>{profile.status}</dd></div><div><dt>Contact number</dt><dd>{profile.contactNumber}</dd></div><div><dt>Home address</dt><dd>{profile.homeAddress}</dd></div><div><dt>Email address</dt><dd>{profile.emailAddress}</dd></div></dl></details><p className="local-data-note"><ShieldCheck size={14} aria-hidden="true" /> Saved only in this browser/device; it is not encrypted or synced.</p></section>

          <DiagnosisSection diagnoses={diagnoses} onAdd={() => { setEditingDiagnosis(null); setShowDiagnosisForm(true) }} onEdit={(diagnosis) => { setEditingDiagnosis(diagnosis); setShowDiagnosisForm(true) }} />

          <section className="section-block history-section" id="history"><div className="section-heading"><div><span className="eyebrow muted">RECENT ACTIVITY</span><h2>Dose history</h2></div><CircleHelp size={18} className="help-icon" /></div>
            {recentLogs.length ? <div className="history-card">{recentLogs.map((log) => { const med = medications.find((item) => item.id === log.medicationId); return <div className="history-row" key={`${log.id}-${log.recordedAt}`}><div className={`history-status ${log.status}`}><Check size={15} /></div><div className="history-med"><strong>{med?.name ?? 'Medication'}</strong><span>{new Date(log.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(log.scheduledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div><span className={`history-label ${log.status}`}>{log.status === 'taken' ? 'Taken' : 'Skipped'}</span></div> })}</div> : <div className="small-empty">Your dose history will appear here after you log a dose.</div>}
          </section>
          <footer className="app-footer"><ShieldCheck size={15} aria-hidden="true" /> <span>Your profile, diagnoses, medication information and logs stay on this device. They are not encrypted, synced, or backed up. Daily Dose does not provide medical advice.</span></footer>
          <p className="version-label">Daily Dose v{__APP_VERSION__} · Built {__BUILD_TIMESTAMP__} PHT</p>
        </div>
      </main>

      {notice && <div className="toast" role="status">{notice}</div>}
      {showForm && <MedicationForm diagnoses={diagnoses} onClose={() => setShowForm(false)} onSave={addMedication} />}
      {showDiagnosisForm && <DiagnosisEditor diagnosis={editingDiagnosis} onClose={() => { setShowDiagnosisForm(false); setEditingDiagnosis(null) }} onSave={saveDiagnosis} />}
      {editingProfile && <ProfileEditor profile={profile} onClose={() => setEditingProfile(false)} onSave={(value) => { setProfile(value); setEditingProfile(false); setNotice('Profile saved on this device.') }} />}
    </div>
  )
}

function DoseRow({ dose, first, last, onRecord }: { dose: Dose; first: boolean; last: boolean; onRecord: (dose: Dose, status: 'taken' | 'skipped') => void }) {
  const isPast = !dose.status && dose.scheduledAt < new Date()
  return <article className={`dose-row ${dose.status ? 'dose-done' : ''}`}><div className="dose-time"><span className="dose-time-text">{formatTime(dose.time)}</span><span className={`timeline ${first ? 'first' : ''} ${last ? 'last' : ''} ${dose.status === 'taken' ? 'filled' : ''}`}><i /></span></div><div className="dose-card"><div className={`dose-symbol ${dose.status === 'taken' ? 'done' : ''}`}><Pill size={18} /></div><div className="dose-details"><div className="dose-name">{dose.medication.name}</div><div className="dose-subtitle">{[dose.medication.amount, dose.medication.form, timeLabel(dose.time)].filter(Boolean).join(' · ')}</div></div>{dose.status ? <span className={`dose-status ${dose.status}`}>{dose.status === 'taken' ? <><Check size={14} /> Taken</> : 'Skipped'}</span> : <div className="dose-actions"><button className="skip-button" onClick={() => onRecord(dose, 'skipped')}>Skip</button><button className="taken-button" onClick={() => onRecord(dose, 'taken')}><Check size={15} /> Take</button></div>}{isPast && <span className="overdue-label">Due earlier</span>}</div></article>
}

export default App
