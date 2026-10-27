'use client';
import { useState } from 'react';
import { useVocelune } from '@/context/VoceluneContext';
export function DeckManager() {
  const { decks, addDeck, updateDeck, deleteDeck } = useVocelune();
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [busy, setBusy] = useState(false);
  const action = async (work: () => Promise<unknown>) => { if (busy) return; setBusy(true); try { await work(); } catch { /* Shared error banner. */ } finally { setBusy(false); } };
  return <section className="border rounded-xl bg-white p-4 text-sm space-y-3"><button className="font-semibold text-brand-primary" onClick={() => setOpen(!open)}>Quản lý bộ từ ({decks.length}) {open ? '−' : '+'}</button>{open && <><form className="flex gap-2" onSubmit={e => { e.preventDefault(); void action(async () => { await addDeck({ name, description: '' }); setName(''); }); }}><input className="border p-2 rounded-lg flex-1" required maxLength={100} placeholder="Tên bộ từ mới" value={name} onChange={e => setName(e.target.value)} /><button disabled={busy} className="bg-brand-primary text-white px-3 rounded-lg">Tạo bộ từ</button></form>{decks.map(deck => <div key={deck.id} className="flex items-center gap-3 border-t pt-2"><span className="flex-1">{deck.name}</span><button disabled={busy} className="text-brand-primary" onClick={() => { const value = prompt('Tên bộ từ', deck.name); if (value?.trim()) void action(() => updateDeck(deck.id, { name: value.trim() })); }}>Đổi tên</button><button disabled={busy || decks.length < 2} className="text-rose-600 disabled:opacity-40" onClick={() => { if (confirm(`Xóa bộ “${deck.name}”? Các từ sẽ được giữ trong bộ còn lại.`)) void action(() => deleteDeck(deck.id)); }}>Xóa</button></div>)}</>}</section>;
}
