import { useEffect, useRef, useState } from 'react'
import { Plus, ShieldCheck, X } from 'lucide-react'
import type { Diagnosis, Medication } from './types'

type Input = Omit<Medication, 'id' | 'createdAt'>
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export function MedicationForm({ diagnoses, onClose, onSave }: { diagnoses: Diagnosis[]; onClose: () => void; onSave: (input: Input) => void }) {
  const dialogRef = useRef<HTMLElement>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [form, setForm] = useState('')
  const [category, setCategory] = useState('Medical')
  const [diagnosisId, setDiagnosisId] = useState('')
  const [frequency, setFrequency] = useState('once')
  const [frequencyOther, setFrequencyOther] = useState('')
  const [startDate, setStartDate] = useState(localToday())
  const [endDate, setEndDate] = useState(localToday())
  const [times, setTimes] = useState(['08:00'])
  const [oneOff, setOneOff] = useState('')
  const [specificReminders, setSpecificReminders] = useState<string[]>([])
  const [instructions, setInstructions] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const root = dialogRef.current
    if (!root) return
    const controls = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)'))
    controls()[0]?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return }
      if (event.key !== 'Tab') return
      const items = controls()
      if (!items.length) return
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); items[0].focus() }
    }
    root.addEventListener('keydown', keydown)
    return () => root.removeEventListener('keydown', keydown)
  }, [onClose])

  function changeFrequency(value: string) {
    setFrequency(value)
    const presets: Record<string, string[]> = { once: ['08:00'], twice: ['08:00', '20:00'], three: ['08:00', '14:00', '20:00'], four: ['08:00', '12:00', '16:00', '20:00'], every8: ['06:00', '14:00', '22:00'] }
    if (presets[value]) setTimes(presets[value])
  }
  function addOneOff() {
    setError('')
    if (!oneOff) return setError('Choose a date and time for this alarm.')
    if (new Date(oneOff) <= new Date()) return setError('Choose a future date and time.')
    if (specificReminders.includes(oneOff)) return setError('That alarm is already on the list.')
    setSpecificReminders((current) => [...current, oneOff].sort())
    setOneOff('')
  }
  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!name.trim()) return setError('Enter the medicine name.')
    if (endDate < startDate) return setError('The medication end date must be on or after its start date.')
    if (frequency === 'other' && !frequencyOther.trim()) return setError('Describe the other dosage frequency.')
    if (specificReminders.some((value) => value.slice(0, 10) < startDate || value.slice(0, 10) > endDate)) return setError('Specific alarms must fall within the medication course dates.')
    const dailyTimes = [...new Set(times.filter(Boolean))].sort()
    if (!dailyTimes.length && !specificReminders.length) return setError('Add at least one daily time alarm or one specific date and time alarm.')
    onSave({ name: name.trim(), amount: amount.trim(), form, category, diagnosisId, frequency, frequencyOther: frequency === 'other' ? frequencyOther.trim() : '', startDate, endDate, times: dailyTimes, specificReminders, instructions: instructions.trim() })
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="medicine-form-title" tabIndex={-1}><div className="modal-header"><div><span className="eyebrow muted">BUILD YOUR ROUTINE</span><h2 id="medicine-form-title">Add medication</h2></div><button className="icon-button close-button" onClick={onClose} aria-label="Close medication form"><X size={20} aria-hidden="true" /></button></div><form onSubmit={submit}>
    <label className="field-label">Medicine name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Vitamin D" required /></label>
    <div className="form-two"><label className="field-label">Medicine strength / amount<input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 500 mg, 1 tablet" /></label><label className="field-label">Medication form<select value={form} onChange={(event) => setForm(event.target.value)}><option value="">Select form</option><option>Tablet</option><option>Capsule</option><option>Liquid</option><option>Drop</option><option>Inhaler</option><option>Other</option></select></label></div>
    <div className="form-two"><label className="field-label">Medication type<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Vitamins</option><option>Medical</option><option>Supplement</option><option>Maintenance</option><option>Others</option></select></label><label className="field-label">Diagnosis <span className="optional">Optional</span><select value={diagnosisId} onChange={(event) => setDiagnosisId(event.target.value)}><option value="">No diagnosis selected</option>{diagnoses.map((diagnosis) => <option key={diagnosis.id} value={diagnosis.id}>{diagnosis.name}</option>)}</select></label></div>
    <label className="field-label">Dosage frequency<select value={frequency} onChange={(event) => changeFrequency(event.target.value)}><option value="once">Once a day</option><option value="twice">Twice a day</option><option value="three">3 times a day</option><option value="four">4 times a day</option><option value="every8">Every 8 hours</option><option value="other">Others</option></select></label>
    {frequency === 'other' && <div className="form-two"><label className="field-label">Other frequency<input value={frequencyOther} onChange={(event) => setFrequencyOther(event.target.value)} placeholder="Describe the interval" required /></label><label className="field-label">Daily alarm count<input type="number" min="1" max="8" value={times.length} onChange={(event) => { const count = Math.min(8, Math.max(1, Number(event.target.value) || 1)); setTimes((current) => Array.from({ length: count }, (_, i) => current[i] ?? '08:00')) }} /></label></div>}
    <fieldset className="alarm-fieldset"><legend>Time alarm{times.length === 1 ? '' : 's'}</legend><p className="field-help">Select the times for recurring daily alarms. Preset times can be adjusted.</p><div className="time-fields">{times.map((time, index) => <label className="field-label" key={index}>{times.length === 1 ? 'Alarm time' : `Alarm ${index + 1}`}<span className="time-input-row"><input type="time" value={time} onChange={(event) => setTimes((current) => current.map((item, i) => i === index ? event.target.value : item))} required={!specificReminders.length} /><button type="button" className="remove-time" disabled={times.length < 2} aria-label={`Remove alarm ${index + 1}`} onClick={() => setTimes((current) => current.filter((_, i) => i !== index))}><X size={15} aria-hidden="true" /></button></span></label>)}</div></fieldset>
    <fieldset className="alarm-fieldset"><legend>Date / time alarm <span className="optional">Optional one-time alarm</span></legend><label className="field-label"><span className="visually-hidden">Specific alarm date and time</span><input type="datetime-local" value={oneOff} min={`${startDate}T00:00`} max={`${endDate}T23:59`} onChange={(event) => setOneOff(event.target.value)} /></label><button type="button" className="subtle-button" onClick={addOneOff}><Plus size={15} aria-hidden="true" /> Add specific alarm</button>{specificReminders.length > 0 && <ul className="specific-reminder-list">{specificReminders.map((value) => <li key={value}><span>{new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span><button type="button" className="remove-button" aria-label={`Remove alarm ${new Date(value).toLocaleString()}`} onClick={() => setSpecificReminders((current) => current.filter((item) => item !== value))}><X size={15} aria-hidden="true" /></button></li>)}</ul>}</fieldset>
    <div className="form-two"><label className="field-label">Medication start<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value) }} required /></label><label className="field-label">Medication end<input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} required /></label></div>
    <label className="field-label">Personal note <span className="optional">Optional</span><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="For example, 'with food'" rows={2} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}<p className="form-note"><ShieldCheck size={16} aria-hidden="true" /> Follow the instructions from your prescription or clinician.</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Plus size={17} aria-hidden="true" /> Save medication</button></div></form></section></div>
}
