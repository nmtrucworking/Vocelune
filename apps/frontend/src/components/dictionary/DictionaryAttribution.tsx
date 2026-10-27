'use client';
import type { DictionaryAttribution as Attribution, DictionaryProvider } from '@/lib/dictionary';
function safeUrl(value: string) { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; } }
export function DictionaryAttribution({ provider, sources }: { provider?: DictionaryProvider; sources: Attribution[] }) {
  return <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
    {provider === 'merriam_webster' && <img src="/dictionary/merriam-webster.png" width={50} height={50} alt="Merriam-Webster Inc." />}
    {sources.map((source, i) => <span key={`${source.url}:${i}`}><a href={safeUrl(source.url)} target="_blank" rel="noopener noreferrer" className="underline">{source.name}</a>{source.license && <> · <a href={safeUrl(source.license.url)} target="_blank" rel="noopener noreferrer" className="underline">{source.license.name}</a></>}</span>)}
  </div>;
}
