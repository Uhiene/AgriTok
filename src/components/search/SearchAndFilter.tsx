import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, RotateCcw, Bookmark, BookmarkCheck,
  SlidersHorizontal, Check,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────

export interface FilterState {
  crops:         string[]
  returnMin:     number
  returnMax:     number
  priceMin:      number
  priceMax:      number
  progressMin:   number
  progressMax:   number
  deadline:      'all' | 'week' | 'month' | 'quarter'
  countries:     string[]
  verifiedOnly:  boolean
  paymentMethod: 'all' | 'stripe' | 'crypto' | 'both'
  sort:          'newest' | 'ending' | 'return' | 'funded' | 'price' | 'relevance'
  q:             string
}

export const DEFAULT_FILTERS: FilterState = {
  crops:         [],
  returnMin:     0,
  returnMax:     40,
  priceMin:      0.1,
  priceMax:      5,
  progressMin:   0,
  progressMax:   100,
  deadline:      'all',
  countries:     [],
  verifiedOnly:  false,
  paymentMethod: 'all',
  sort:          'newest',
  q:             '',
}

export function countActiveFilters(f: FilterState): number {
  let n = 0
  if (f.crops.length)            n++
  if (f.returnMin > 0 || f.returnMax < 40) n++
  if (f.priceMin > 0.1 || f.priceMax < 5) n++
  if (f.progressMin > 0 || f.progressMax < 100) n++
  if (f.deadline !== 'all')      n++
  if (f.countries.length)        n++
  if (f.verifiedOnly)            n++
  if (f.paymentMethod !== 'all') n++
  return n
}

interface SavedSearch {
  id:    string
  label: string
  state: FilterState
}

const SAVED_KEY = 'agritoken-saved-searches'

function loadSaved(): SavedSearch[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') } catch { return [] }
}
function writeSaved(s: SavedSearch[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(s))
}

// ── Shared UI ─────────────────────────────────────────────────

const CROPS = ['Maize', 'Rice', 'Cassava', 'Wheat', 'Sorghum', 'Millet', 'Soybean', 'Cocoa', 'Coffee', 'Groundnut', 'Tomato']
const COUNTRIES = ['Nigeria', 'Kenya', 'Ghana', 'Vietnam', 'Bangladesh', 'India', 'Tanzania', 'Ethiopia']
export const DEADLINE_OPTIONS: { value: FilterState['deadline']; label: string }[] = [
  { value: 'all',     label: 'Any time' },
  { value: 'week',    label: 'Ending soon (< 7 days)' },
  { value: 'month',   label: '1 – 4 weeks' },
  { value: 'quarter', label: '1 – 3 months' },
]
const PAYMENT_OPTIONS: { value: FilterState['paymentMethod']; label: string }[] = [
  { value: 'all',    label: 'Any' },
  { value: 'stripe', label: 'Card (Stripe)' },
  { value: 'crypto', label: 'Crypto only' },
  { value: 'both',   label: 'Card + Crypto' },
]

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="font-body text-xs font-semibold text-forest-dark uppercase tracking-wider">{label}</p>
      {children}
    </div>
  )
}

function RangeSlider({
  min, max, step, valueMin, valueMax,
  onChangeMin, onChangeMax,
  format,
}: {
  min: number; max: number; step: number
  valueMin: number; valueMax: number
  onChangeMin: (v: number) => void
  onChangeMax: (v: number) => void
  format: (v: number) => string
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100

  return (
    <div className="space-y-2">
      <div className="flex justify-between font-body text-xs text-text-muted">
        <span>{format(valueMin)}</span>
        <span>{format(valueMax)}</span>
      </div>
      <div className="relative h-6 flex items-center">
        {/* track */}
        <div className="absolute w-full h-1.5 rounded-full bg-forest-dark/10" />
        {/* filled range */}
        <div
          className="absolute h-1.5 rounded-full bg-accent-green"
          style={{ left: `${pct(valueMin)}%`, width: `${pct(valueMax) - pct(valueMin)}%` }}
        />
        {/* min thumb */}
        <input
          type="range" min={min} max={max} step={step} value={valueMin}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (v <= valueMax) onChangeMin(v)
          }}
          className="absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer range-thumb"
        />
        {/* max thumb */}
        <input
          type="range" min={min} max={max} step={step} value={valueMax}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (v >= valueMin) onChangeMax(v)
          }}
          className="absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer range-thumb"
        />
      </div>
    </div>
  )
}

function MultiSelect({
  options, selected, onChange,
}: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-pill border font-body text-xs font-medium transition-all ${
              active
                ? 'bg-accent-green border-accent-green text-forest-dark'
                : 'bg-white border-[rgba(13,43,30,0.12)] text-text-muted hover:border-forest-mid/30 hover:text-forest-dark'
            }`}
          >
            {active && <Check size={10} strokeWidth={3} />}
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

interface Props {
  isOpen:   boolean
  onClose:  () => void
  filters:  FilterState
  onChange: (f: FilterState) => void
}

export default function SearchAndFilter({ isOpen, onClose, filters, onChange }: Props) {
  const [local, setLocal]         = useState<FilterState>(filters)
  const [saved, setSaved]         = useState<SavedSearch[]>(loadSaved)
  const [saveLabel, setSaveLabel] = useState('')
  const [saving, setSaving]       = useState(false)
  const overlayRef                = useRef<HTMLDivElement>(null)

  // Sync local state when filters change externally (e.g. URL nav)
  useEffect(() => { setLocal(filters) }, [filters])

  const set = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
    setLocal((prev) => ({ ...prev, [key]: val }))

  function apply() {
    onChange(local)
    onClose()
  }

  function reset() {
    const fresh = { ...DEFAULT_FILTERS, q: filters.q, sort: filters.sort }
    setLocal(fresh)
    onChange(fresh)
  }

  function saveSearch() {
    if (!saveLabel.trim() || saved.length >= 5) return
    const entry: SavedSearch = { id: Date.now().toString(), label: saveLabel.trim(), state: local }
    const next = [...saved, entry]
    setSaved(next)
    writeSaved(next)
    setSaveLabel('')
    setSaving(false)
  }

  function deleteSearch(id: string) {
    const next = saved.filter((s) => s.id !== id)
    setSaved(next)
    writeSaved(next)
  }

  function applySearch(s: SavedSearch) {
    setLocal(s.state)
    onChange(s.state)
    onClose()
  }

  const activeCount = countActiveFilters(local)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-forest-dark/40 z-40 lg:hidden"
            onClick={onClose}
          />

          {/* Panel — slides up on mobile, slides in from right on desktop */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[20px] shadow-2xl max-h-[90vh] flex flex-col lg:hidden"
          >
            <FilterBody
              local={local} set={set} reset={reset} apply={apply}
              activeCount={activeCount}
              saved={saved} saveLabel={saveLabel} setSaveLabel={setSaveLabel}
              saving={saving} setSaving={setSaving}
              saveSearch={saveSearch} deleteSearch={deleteSearch} applySearch={applySearch}
              onClose={onClose}
            />
          </motion.div>

          {/* Desktop side panel */}
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="hidden lg:flex fixed right-0 top-0 bottom-0 w-[360px] bg-white shadow-2xl z-50 flex-col"
          >
            <FilterBody
              local={local} set={set} reset={reset} apply={apply}
              activeCount={activeCount}
              saved={saved} saveLabel={saveLabel} setSaveLabel={setSaveLabel}
              saving={saving} setSaving={setSaving}
              saveSearch={saveSearch} deleteSearch={deleteSearch} applySearch={applySearch}
              onClose={onClose}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Filter body (shared between mobile sheet + desktop panel) ─

function FilterBody({
  local, set, reset, apply, activeCount,
  saved, saveLabel, setSaveLabel, saving, setSaving,
  saveSearch, deleteSearch, applySearch, onClose,
}: {
  local: FilterState
  set: <K extends keyof FilterState>(k: K, v: FilterState[K]) => void
  reset: () => void
  apply: () => void
  activeCount: number
  saved: SavedSearch[]
  saveLabel: string
  setSaveLabel: (v: string) => void
  saving: boolean
  setSaving: (v: boolean) => void
  saveSearch: () => void
  deleteSearch: (id: string) => void
  applySearch: (s: SavedSearch) => void
  onClose: () => void
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[rgba(13,43,30,0.08)] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal size={16} className="text-forest-dark" strokeWidth={2} />
          <span className="font-display text-lg text-forest-dark">Filters</span>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-pill bg-accent-green text-forest-dark font-body text-xs font-semibold">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={reset} className="flex items-center gap-1 font-body text-xs text-text-muted hover:text-forest-dark transition-colors">
            <RotateCcw size={12} strokeWidth={2.5} /> Reset all
          </button>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-forest-dark/6 flex items-center justify-center hover:bg-forest-dark/10 transition-colors">
            <X size={14} strokeWidth={2.5} className="text-forest-dark" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

        {/* Saved searches */}
        {saved.length > 0 && (
          <Section label="Saved Searches">
            <div className="space-y-2">
              {saved.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-card bg-forest-dark/4 hover:bg-forest-dark/6 transition-colors">
                  <button type="button" onClick={() => applySearch(s)} className="flex items-center gap-2 font-body text-sm text-forest-dark font-medium flex-1 text-left">
                    <BookmarkCheck size={13} className="text-accent-green flex-shrink-0" strokeWidth={2.5} />
                    {s.label}
                  </button>
                  <button type="button" onClick={() => deleteSearch(s.id)} className="ml-2 text-text-muted hover:text-red-500 transition-colors">
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Crop type */}
        <Section label="Crop Type">
          <MultiSelect options={CROPS} selected={local.crops} onChange={(v) => set('crops', v)} />
        </Section>

        {/* Expected return */}
        <Section label="Expected Return">
          <RangeSlider
            min={0} max={40} step={1}
            valueMin={local.returnMin} valueMax={local.returnMax}
            onChangeMin={(v) => set('returnMin', v)}
            onChangeMax={(v) => set('returnMax', v)}
            format={(v) => `${v}%`}
          />
        </Section>

        {/* Token price */}
        <Section label="Token Price">
          <RangeSlider
            min={0.1} max={5} step={0.1}
            valueMin={local.priceMin} valueMax={local.priceMax}
            onChangeMin={(v) => set('priceMin', v)}
            onChangeMax={(v) => set('priceMax', v)}
            format={(v) => `$${v.toFixed(2)}`}
          />
        </Section>

        {/* Funding progress */}
        <Section label="Funding Progress">
          <RangeSlider
            min={0} max={100} step={5}
            valueMin={local.progressMin} valueMax={local.progressMax}
            onChangeMin={(v) => set('progressMin', v)}
            onChangeMax={(v) => set('progressMax', v)}
            format={(v) => `${v}%`}
          />
        </Section>

        {/* Days until deadline */}
        <Section label="Days Until Deadline">
          <div className="space-y-2">
            {DEADLINE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                  local.deadline === opt.value
                    ? 'border-accent-green bg-accent-green'
                    : 'border-[rgba(13,43,30,0.2)] group-hover:border-accent-green/60'
                }`}>
                  {local.deadline === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-forest-dark" />}
                </div>
                <input
                  type="radio" name="deadline" value={opt.value}
                  checked={local.deadline === opt.value}
                  onChange={() => set('deadline', opt.value)}
                  className="sr-only"
                />
                <span className="font-body text-sm text-forest-dark">{opt.label}</span>
              </label>
            ))}
          </div>
        </Section>

        {/* Country */}
        <Section label="Country">
          <MultiSelect options={COUNTRIES} selected={local.countries} onChange={(v) => set('countries', v)} />
        </Section>

        {/* Verified farms */}
        <Section label="Farm Verification">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="font-body text-sm text-forest-dark">Verified farms only</span>
            <div
              onClick={() => set('verifiedOnly', !local.verifiedOnly)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${local.verifiedOnly ? 'bg-accent-green' : 'bg-forest-dark/20'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${local.verifiedOnly ? 'left-[22px]' : 'left-0.5'}`} />
            </div>
          </label>
        </Section>

        {/* Payment method */}
        <Section label="Payment Method">
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('paymentMethod', opt.value)}
                className={`px-3 py-2 rounded-card border font-body text-xs font-medium transition-all ${
                  local.paymentMethod === opt.value
                    ? 'bg-forest-dark text-white border-forest-dark'
                    : 'bg-white border-[rgba(13,43,30,0.12)] text-text-muted hover:border-forest-mid/30 hover:text-forest-dark'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Save this search */}
        <Section label="Save Search">
          {saved.length >= 5 ? (
            <p className="font-body text-xs text-text-muted">Maximum 5 saved searches reached. Delete one to save a new search.</p>
          ) : saving ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveSearch(); if (e.key === 'Escape') setSaving(false) }}
                placeholder="Name this search..."
                className="flex-1 px-3 py-2 rounded-card border border-[rgba(13,43,30,0.12)] font-body text-sm text-forest-dark focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green transition-colors"
              />
              <button type="button" onClick={saveSearch} disabled={!saveLabel.trim()} className="px-3 py-2 rounded-card bg-accent-green text-forest-dark font-body text-xs font-semibold disabled:opacity-50">
                Save
              </button>
              <button type="button" onClick={() => setSaving(false)} className="px-3 py-2 rounded-card border border-[rgba(13,43,30,0.12)] text-text-muted font-body text-xs">
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSaving(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-card border border-dashed border-[rgba(13,43,30,0.2)] text-text-muted hover:text-forest-dark hover:border-forest-mid/40 transition-colors font-body text-xs"
            >
              <Bookmark size={13} strokeWidth={2} />
              Save this search ({saved.length}/5)
            </button>
          )}
        </Section>

      </div>

      {/* Footer CTA */}
      <div className="px-5 py-4 border-t border-[rgba(13,43,30,0.08)] flex-shrink-0">
        <button
          type="button"
          onClick={apply}
          className="w-full py-3 rounded-pill bg-forest-dark text-white font-body text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {activeCount > 0 ? `Apply ${activeCount} filter${activeCount !== 1 ? 's' : ''}` : 'Apply'}
        </button>
      </div>
    </>
  )
}
