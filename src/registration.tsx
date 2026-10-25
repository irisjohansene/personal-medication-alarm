import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Pill, ShieldCheck, Sparkles, Sun, Moon, UserRound, X } from 'lucide-react'
import type { Profile, ThemeMode } from './types'

const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function Fields({ value, onSave, buttonText, onCancel, autoFocus = false }: { value?: Profile; onSave: (profile: Profile) => void; buttonText: string; onCancel?: () => void; autoFocus?: boolean }) {
  const [form, setForm] = useState<Profile>(value ?? { name: '', sex: '', birthday: '', nationality: '', status: '', contactNumber: '', homeAddress: '', emailAddress: '' })
  const update = (key: keyof Profile, text: string) => setForm((current) => ({ ...current, [key]: text }))
  return <form className="profile-form" onSubmit={(event) => { event.preventDefault(); onSave({ name: form.name.trim(), sex: form.sex.trim(), birthday: form.birthday, nationality: form.nationality.trim(), status: form.status.trim(), contactNumber: form.contactNumber.trim(), homeAddress: form.homeAddress.trim(), emailAddress: form.emailAddress.trim() }) }}>
    <div className="form-two"><label className="field-label">Name<input autoFocus={autoFocus} autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} required /></label><label className="field-label">Sex<input autoComplete="sex" value={form.sex} onChange={(e) => update('sex', e.target.value)} required /></label></div>
    <div className="form-two"><label className="field-label">Birthday<input type="date" autoComplete="bday" max={today()} value={form.birthday} onChange={(e) => update('birthday', e.target.value)} required /></label><label className="field-label">Nationality<input autoComplete="country-name" value={form.nationality} onChange={(e) => update('nationality', e.target.value)} required /></label></div>
    <div className="form-two"><label className="field-label">Status<input value={form.status} onChange={(e) => update('status', e.target.value)} required /></label><label className="field-label">Contact number<input type="tel" autoComplete="tel" value={form.contactNumber} onChange={(e) => update('contactNumber', e.target.value)} required /></label></div>
    <label className="field-label">Home address<input autoComplete="street-address" value={form.homeAddress} onChange={(e) => update('homeAddress', e.target.value)} required /></label>
    <label className="field-label">Email address<input type="email" autoComplete="email" value={form.emailAddress} onChange={(e) => update('emailAddress', e.target.value)} required /></label>
    <div className="profile-form-actions">{onCancel && <button type="button" className="cancel-button" onClick={onCancel}>Cancel</button>}<button className="primary-button" type="submit">{buttonText}<ChevronRight size={17} aria-hidden="true" /></button></div>
  </form>
}

export function ProfileRegistration({ onSave, theme, onThemeChange }: { onSave: (profile: Profile) => void; theme: ThemeMode; onThemeChange: (theme: ThemeMode) => void }) {
  return <main className="registration-shell"><a className="skip-link" href="#register-fields">Skip to registration form</a><section className="registration-card"><div className="registration-top"><a className="brand" href="#register" aria-label="Daily Dose"><span className="brand-mark"><Pill size={21} aria-hidden="true" /></span><span>daily<span className="brand-light">dose</span></span></a><label className="theme-control"><span className="theme-control-label"><Sun size={14} aria-hidden="true" /><Moon size={14} aria-hidden="true" /> Theme</span><select aria-label="Color theme" value={theme} onChange={(event) => onThemeChange(event.target.value as ThemeMode)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div><div className="registration-intro"><div className="eyebrow"><Sparkles size={14} aria-hidden="true" /> FREE PERSONAL MEDICATION ALARM</div><h1>Welcome to your<br />Personal Medication Alarm</h1><p>Create your profile to continue to your medication dashboard. No online account is created.</p></div><div id="register-fields"><Fields autoFocus onSave={onSave} buttonText="Continue to your dashboard" /></div><p className="privacy-callout"><ShieldCheck size={17} aria-hidden="true" /> Profile and health details stay in this browser on this device. They are not encrypted, synced, or backed up. Enter only information you are comfortable storing here.</p><p className="registration-footnote">Daily Dose is a reminder and logging tool, not medical advice or a substitute for your clinician's instructions.</p></section></main>
}

export function ProfileEditor({ profile, onSave, onClose }: { profile: Profile; onSave: (profile: Profile) => void; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)'))
    focusable()[0]?.focus()
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); items[0].focus() }
    }
    root.addEventListener('keydown', handle)
    return () => root.removeEventListener('keydown', handle)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" tabIndex={-1}><div className="modal-header"><div><span className="eyebrow muted"><UserRound size={13} aria-hidden="true" /> YOUR PROFILE</span><h2 id="profile-dialog-title">Edit personal information</h2></div><button className="icon-button close-button" aria-label="Close profile editor" onClick={onClose}><X size={20} aria-hidden="true" /></button></div><Fields value={profile} onSave={onSave} onCancel={onClose} buttonText="Save profile" /><p className="form-note"><ShieldCheck size={15} aria-hidden="true" /> Saved in local browser storage on this device.</p></section></div>
}
