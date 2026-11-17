import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { useUI } from '../../ui-context';
import { uid } from '../../lib/id';
import { Button, ConfirmSheet, Field, Input, Sheet, Textarea } from '../ui';
import { customerLedger } from '../../lib/money';
import { fmtWords } from '../../lib/format';

export function CustomerForm({ id }: { id?: string }) {
  const { data, dispatch, replaceAll, restoreSnapshot } = useStore();
  const [askDelete, setAskDelete] = useState(false);
  const { close, toast, go } = useUI();
  const existing = data.customers.find((c) => c.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [note, setNote] = useState(existing?.note ?? '');

  const dup = data.customers.some((c) => c.id !== id && c.name.trim().toLocaleLowerCase('tr') === name.trim().toLocaleLowerCase('tr'));

  const save = () => {
    if (!name.trim() || dup) return;
    const c = {
      id: existing?.id ?? uid(),
      name: name.trim(),
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    dispatch({ type: 'upsertCustomer', customer: c });
    toast(existing ? 'Müşteri güncellendi' : 'Müşteri eklendi');
    close();
    if (!existing) go({ tab: 'customers', customerId: c.id });
  };

  const jobCount = existing ? data.jobs.filter((j) => j.customerId === existing.id).length : 0;
  const payCount = existing ? data.payments.filter((p) => p.customerId === existing.id).length : 0;

  const remove = async () => {
    if (!existing) return;
    const id0 = existing.id;
    // Önce geri dönüş noktası alınır, sonra müşteri ve tüm kayıtları silinir
    const ok = await replaceAll(
      { ...data, customers: data.customers.filter((c) => c.id !== id0), jobs: data.jobs.filter((j) => j.customerId !== id0), payments: data.payments.filter((p) => p.customerId !== id0) },
      `“${existing.name}” silme`,
    );
    if (!ok) {
      toast('Geri dönüş noktası kaydedilemediği için müşteri silinmedi.', 'err');
      return;
    }
    close();
    go({ tab: 'customers' });
    toast(`${existing.name} silindi`, 'ok', { label: 'Geri al', run: () => void restoreSnapshot() });
  };

  return (
    <Sheet
      open
      onClose={close}
      title={existing ? 'Müşteriyi düzenle' : 'Yeni müşteri'}
      footer={
        <div className="flex gap-2">
          {existing && (
            <Button variant="danger" onClick={() => setAskDelete(true)} aria-label="Müşteriyi sil">
              <Trash2 size={18} />
            </Button>
          )}
          <Button variant="primary" className="flex-1" onClick={save} disabled={!name.trim() || dup}>
            {existing ? 'Değişikliği kaydet' : 'Müşteriyi kaydet'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Müşteri veya firma adı" hint={dup ? <span className="text-due">Bu isimde bir müşteri zaten var.</span> : undefined}>
          <Input autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. ABC Makina" onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        <Field label="Telefon (isteğe bağlı)">
          <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" />
        </Field>
        <Field label="Not (isteğe bağlı)">
          <Textarea maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Yetkili kişi, adres vb." />
        </Field>
      </div>
      {askDelete && existing && (
        <ConfirmSheet
          title="Müşteri silinsin mi?"
          confirmLabel="Müşteriyi ve kayıtlarını sil"
          danger
          message={
            <>
              <p>
                <b>{existing.name}</b>, {jobCount} işi ve {payCount} ödemesiyle birlikte silinecek.
              </p>
              <p className="mt-2">Kalan borcu: {fmtWords(customerLedger(data, existing.id).balance)}</p>
              <p className="mt-2 text-pencil">Yanlışlıkla silerseniz hemen çıkan “Geri al” düğmesiyle veya Ayarlar'dan geri getirebilirsiniz.</p>
            </>
          }
          onCancel={() => setAskDelete(false)}
          onConfirm={() => {
            setAskDelete(false);
            void remove();
          }}
        />
      )}
    </Sheet>
  );
}
