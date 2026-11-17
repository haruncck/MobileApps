import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { useUI } from '../../ui-context';
import { uid } from '../../lib/id';
import { parseNum, SYMBOL, today, fmt } from '../../lib/format';
import { round2 } from '../../lib/money';
import type { Currency, JobStatus } from '../../types';
import { CURRENCIES, JOB_STATUS_LABEL } from '../../types';
import { Button, Field, Input, Segmented, Select, Sheet, Textarea } from '../ui';

const NEW = '__new__';

export function JobForm({ id, customerId }: { id?: string; customerId?: string }) {
  const { data, dispatch } = useStore();
  const { close, toast } = useUI();
  const existing = data.jobs.find((j) => j.id === id);

  const [cid, setCid] = useState(existing?.customerId ?? customerId ?? data.customers[0]?.id ?? NEW);
  const [newName, setNewName] = useState('');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [amount, setAmount] = useState(existing ? String(existing.amount).replace('.', ',') : '');
  const [currency, setCurrency] = useState<Currency>(existing?.currency ?? 'TRY');
  const [status, setStatus] = useState<JobStatus>(existing?.status ?? 'tamamlandi');
  const [note, setNote] = useState(existing?.note ?? '');

  const amt = parseNum(amount);
  const valid = title.trim() && amt > 0 && (cid !== NEW || newName.trim());

  const save = () => {
    if (!valid) return;
    let customerIdFinal = cid;
    if (cid === NEW) {
      const found = data.customers.find((c) => c.name.toLocaleLowerCase('tr') === newName.trim().toLocaleLowerCase('tr'));
      customerIdFinal = found?.id ?? uid();
      if (!found) dispatch({ type: 'upsertCustomer', customer: { id: customerIdFinal, name: newName.trim(), createdAt: new Date().toISOString() } });
    }
    dispatch({
      type: 'upsertJob',
      job: {
        id: existing?.id ?? uid(),
        customerId: customerIdFinal,
        title: title.trim(),
        date,
        amount: round2(amt),
        currency,
        status,
        note: note.trim() || undefined,
      },
    });
    toast(existing ? 'İş güncellendi' : `İş eklendi: ${fmt(round2(amt), currency)}`);
    close();
  };

  const remove = () => {
    if (!existing || !confirm(`"${existing.title}" işi silinsin mi?`)) return;
    dispatch({ type: 'deleteJob', id: existing.id });
    toast('İş silindi');
    close();
  };

  return (
    <Sheet
      open
      onClose={close}
      title={existing ? 'İşi Düzenle' : 'Yeni İş (Hakediş)'}
      footer={
        <div className="flex gap-2">
          {existing && (
            <Button variant="danger" onClick={remove} aria-label="Sil">
              <Trash2 size={18} />
            </Button>
          )}
          <Button variant="primary" className="flex-1" onClick={save} disabled={!valid}>
            {existing ? 'Güncelle' : 'İşi Kaydet'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Müşteri">
          <Select value={cid} onChange={(e) => setCid(e.target.value)}>
            {data.customers
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            <option value={NEW}>+ Yeni müşteri oluştur…</option>
          </Select>
        </Field>
        {cid === NEW && (
          <Field label="Yeni Müşteri Adı">
            <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Firma adı" />
          </Field>
        )}
        <Field label="İşin Adı / Açıklaması">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Hidrolik Pano, PLC Yazılımı" autoFocus={cid !== NEW && !existing} />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Tutar">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">{SYMBOL[currency]}</span>
              <Input className="num pl-8 text-lg font-semibold" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
          </Field>
          <Field label="Para Birimi">
            <Segmented value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: SYMBOL[c] }))} className="w-36" />
          </Field>
        </div>
        <Field label="Tarih">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Durum">
          <Segmented
            value={status}
            onChange={setStatus}
            options={(Object.keys(JOB_STATUS_LABEL) as JobStatus[]).map((s) => ({ value: s, label: <span className="text-xs sm:text-sm">{JOB_STATUS_LABEL[s]}</span> }))}
          />
        </Field>
        <Field label="Not (opsiyonel)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Teklif no, fatura no, detay…" />
        </Field>
      </div>
    </Sheet>
  );
}
