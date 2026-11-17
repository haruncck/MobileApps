import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { useUI } from '../../ui-context';
import { uid } from '../../lib/id';
import { Button, Field, Input, Sheet, Textarea } from '../ui';

export function CustomerForm({ id }: { id?: string }) {
  const { data, dispatch } = useStore();
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

  const remove = () => {
    if (!existing) return;
    const n = data.jobs.filter((j) => j.customerId === existing.id).length + data.payments.filter((p) => p.customerId === existing.id).length;
    if (!confirm(`"${existing.name}" ve bağlı ${n} kayıt silinecek. Emin misiniz?`)) return;
    dispatch({ type: 'deleteCustomer', id: existing.id });
    toast('Müşteri silindi');
    close();
    go({ tab: 'customers' });
  };

  return (
    <Sheet
      open
      onClose={close}
      title={existing ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}
      footer={
        <div className="flex gap-2">
          {existing && (
            <Button variant="danger" onClick={remove} aria-label="Sil">
              <Trash2 size={18} />
            </Button>
          )}
          <Button variant="primary" className="flex-1" onClick={save} disabled={!name.trim() || dup}>
            Kaydet
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Müşteri / Firma Adı" hint={dup ? <span className="text-rose-400">Bu isimde bir müşteri zaten var.</span> : undefined}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. ABC Makina" onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        <Field label="Telefon (opsiyonel)">
          <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" />
        </Field>
        <Field label="Not (opsiyonel)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Yetkili kişi, adres vb." />
        </Field>
      </div>
    </Sheet>
  );
}
