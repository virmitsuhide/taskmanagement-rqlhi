'use client'

import { useActionState, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { updateSiteTextAction } from '@/app/actions/site'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { FooterLink, FooterUnit, SiteSettings } from '@/types'
import { FormFeedback } from './FormFeedback'

type FormState = { error?: string; success?: string } | null

export function HeaderFooterForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    updateSiteTextAction,
    null,
  )

  // Baris unit & link bisa ditambah/dihapus di klien. Server membuang baris
  // yang nama/label-nya kosong, jadi baris baru yang tidak diisi aman diabaikan.
  const [units, setUnits] = useState<FooterUnit[]>(settings.footer_units)
  const [links, setLinks] = useState<FooterLink[]>(settings.footer_links)

  return (
    <form action={formAction} className="space-y-8 pb-10">

      <Fieldset title="Header" desc="Teks di samping logo, tampil di semua halaman publik.">
        <Field id="header_brand" label="Nama lembaga" defaultValue={settings.header_brand} />
        <Field
          id="header_tagline"
          label="Baris kecil di bawah nama"
          defaultValue={settings.header_tagline}
          hint="Tampil huruf kapital kecil. Contoh: Web App RQ LHI · Banguntapan"
        />
      </Fieldset>

      <Fieldset title="Footer — Brand" desc="Blok kiri footer.">
        <Field id="footer_brand" label="Nama lembaga" defaultValue={settings.footer_brand} />
        <Field id="footer_brand_sub" label="Sub-teks" defaultValue={settings.footer_brand_sub} />
        <div className="space-y-1.5">
          <Label htmlFor="footer_tagline">Deskripsi singkat</Label>
          <Textarea
            id="footer_tagline"
            name="footer_tagline"
            rows={3}
            defaultValue={settings.footer_tagline}
          />
        </div>
      </Fieldset>

      <Fieldset title="Footer — Unit Pendidikan" desc="Alamat unit yang tampil di kolom kedua.">
        <div className="space-y-3">
          {units.map((unit, i) => (
            <div key={i} className="rounded-lg border bg-muted/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Unit {i + 1}</span>
                <RemoveButton
                  label={`Hapus unit ${i + 1}`}
                  onClick={() => setUnits(units.filter((_, x) => x !== i))}
                />
              </div>
              <Input name="unit_name" defaultValue={unit.name} placeholder="Nama unit — mis. SDIT LHI" />
              <Textarea
                name="unit_address"
                rows={2}
                defaultValue={unit.address}
                placeholder={'Alamat\n(boleh beberapa baris)'}
              />
              <Input name="unit_phone" defaultValue={unit.phone} placeholder="Telepon" />
            </div>
          ))}
          <AddButton
            label="Tambah unit"
            onClick={() => setUnits([...units, { name: '', address: '', phone: '' }])}
          />
        </div>
      </Fieldset>

      <Fieldset title="Footer — Jelajahi" desc="Daftar tautan di kolom ketiga.">
        <div className="space-y-2.5">
          {links.map((link, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input name="link_label" defaultValue={link.label} placeholder="Label" className="flex-1" />
              <Input name="link_href" defaultValue={link.href} placeholder="/tujuan" className="flex-1" />
              <RemoveButton
                label={`Hapus tautan ${link.label || i + 1}`}
                onClick={() => setLinks(links.filter((_, x) => x !== i))}
              />
            </div>
          ))}
          <AddButton label="Tambah tautan" onClick={() => setLinks([...links, { label: '', href: '' }])} />
        </div>
      </Fieldset>

      <Fieldset title="Footer — Kontak & Copyright" desc="Kolom keempat dan baris paling bawah.">
        <Field id="footer_email" label="Email" defaultValue={settings.footer_email} />
        <Field id="footer_phone" label="Telepon" defaultValue={settings.footer_phone} />
        <Field id="footer_hours" label="Jam layanan" defaultValue={settings.footer_hours} />
        <Field
          id="footer_copyright"
          label="Teks copyright"
          defaultValue={settings.footer_copyright}
          hint="Tahun ditambahkan otomatis di depan teks ini."
        />
      </Fieldset>

      <FormFeedback state={state} />

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? 'Menyimpan…' : 'Simpan Perubahan'}
      </Button>
    </form>
  )
}

/* ─── Potongan UI kecil ───────────────────────────────────────────── */

function Fieldset({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5 mb-4">{desc}</p>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({
  id, label, defaultValue, hint,
}: { id: string; label: string; defaultValue: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} defaultValue={defaultValue} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      <Plus className="h-3.5 w-3.5 mr-1.5" />
      {label}
    </Button>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="shrink-0 rounded-md p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
