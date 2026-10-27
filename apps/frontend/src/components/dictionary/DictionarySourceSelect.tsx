'use client';
import { DICTIONARY_SOURCES, DictionaryProvider, DictionaryProviderStatus } from '@/lib/dictionary';
export function DictionarySourceSelect({ id, value, providers, onChange, disabled = false }: {
  id: string; value: DictionaryProvider; providers: DictionaryProviderStatus[]; onChange: (value: DictionaryProvider) => void; disabled?: boolean;
}) {
  return <div className="space-y-1.5"><label htmlFor={id} className="text-xs font-semibold text-brand-ink">Nguồn từ điển</label>
    <select id={id} value={value} onChange={e => onChange(e.target.value as DictionaryProvider)} disabled={disabled} className="w-full px-3 py-2 text-sm border rounded-control bg-surface-subtle focus:outline-none focus:border-brand-primary">
      {(['free', 'api_key'] as const).map(tier => <optgroup key={tier} label={tier === 'free' ? 'Tầng 1 · Miễn phí, không cần key' : 'Tầng 2 · Dùng API key'}>
        {DICTIONARY_SOURCES.filter(source => source.tier === tier).map(source => {
          const status = providers.find(p => p.id === source.id);
          return <option key={source.id} value={source.id}>{source.name}{status && !status.configured ? ' — chưa cấu hình key' : ''}</option>;
        })}
      </optgroup>)}
    </select>
  </div>;
}
