import { useEffect, useRef, useState } from 'react'
import { Plus, ShieldCheck, Stethoscope, X } from 'lucide-react'
import type { Diagnosis } from './types'

export function DiagnosisSection({ diagnoses, onAdd, onEdit }: { diagnoses: Diagnosis[]; onAdd: () => void; onEdit: (diagnosis: Diagnosis) => void }) {
  return <section className="section-block health-section" id="health" aria-labelledby="health-heading"><div className="section-heading"><div><span className="eyebrow muted">YOUR HEALTH DETAILS</span><h2 id="health-heading">Diagnoses</h2></div><button className="subtle-button" onClick={onAdd}><Plus size={16} aria-hidden="true" /> Add diagnosis</button></div>{diagnoses.length ? <div className="diagnosis-list">{diagnoses.map((diagnosis) => <article className="diagnosis-card" key={diagnosis.id}><div className="diagnosis-icon"><Stethoscope size={17} aria-hidden="true" /></div><div className="diagnosis-copy"><h3>{diagnosis.name}</h3>{diagnosis.notes && <p>{diagnosis.notes}</p>}</div><button className="subtle-button" onClick={() => onEdit(diagnosis)}>Edit</button></article>)}</div> : <div className="small-empty"><Stethoscope size={18} aria-hidden="true" /> No diagnoses saved. Add one if it helps organize your medication plan.</div>}</section>
}

export function DiagnosisEditor({ diagnosis, onSave, onClose }: { diagnosis: Diagnosis | null; onSave: (input: { name: string; notes: string }) => void; onClose: () => void }) {
  const [name, setName] = useState(diagnosis?.name ?? '')
  const [notes, setNotes] = useState(diagnosis?.notes ?? '')
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)'))
    focusable()[0]?.focus()
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); items[0].focus() }
    }
    root.addEventListener('keydown', handle)
    return () => root.removeEventListener('keydown', handle)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="diagnosis-form-title" tabIndex={-1}><div className="modal-header"><div><span className="eyebrow muted">HEALTH DETAILS</span><h2 id="diagnosis-form-title">{diagnosis ? 'Edit diagnosis' : 'Add diagnosis'}</h2></div><button className="icon-button close-button" aria-label="Close diagnosis form" onClick={onClose}><X size={20} aria-hidden="true" /></button></div><form onSubmit={(event) => { event.preventDefault(); onSave({ name: name.trim(), notes: notes.trim() }) }}><label className="field-label">Diagnosis<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="field-label">Personal note <span className="optional">Optional</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} /></label><p className="form-note"><ShieldCheck size={15} aria-hidden="true" /> Diagnosis details are stored only on this device.</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{diagnosis ? 'Save changes' : 'Save diagnosis'}</button></div></form></section></div>
}
