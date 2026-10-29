'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Globe,
  Download,
  BookOpen,
  Sparkles,
  Users,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { PublicDeckPreview } from '@/types';
import { api } from '@/lib/api';
import { AudioButton } from '../common/AudioButton';
import { triggerConfetti } from '@/lib/confetti';

interface PublicDeckPreviewModalProps {
  deckId: string | null;
  onClose: () => void;
  onForkSuccess?: () => void;
}

export function PublicDeckPreviewModal({
  deckId,
  onClose,
  onForkSuccess,
}: PublicDeckPreviewModalProps) {
  const { forkPublicDeck, settings } = useVocelune();
  const [loading, setLoading] = useState(false);
  const [forking, setForking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicDeckPreview | null>(null);
  const [forkSuccess, setForkSuccess] = useState(false);

  useEffect(() => {
    if (!deckId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setForkSuccess(false);

    api<PublicDeckPreview>(`/decks/public/${deckId}`)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Không thể tải thông tin bộ từ.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [deckId]);

  if (!deckId) return null;

  const handleFork = async () => {
    if (!deckId || forking) return;
    setForking(true);
    try {
      await forkPublicDeck(deckId);
      triggerConfetti();
      setForkSuccess(true);
      setTimeout(() => {
        onForkSuccess?.();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu bộ từ.');
    } finally {
      setForking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-card shadow-modal max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-gradient-to-r from-surface-base to-brand-canvas/30">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-xs shrink-0"
              style={{ backgroundColor: data?.color || '#4F46E5' }}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-brand-ink">
                  {data?.name || 'Đang tải...'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                  {data?.topicGroup || 'Chung'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-secondary mt-1">
                <span className="flex items-center gap-1.5">
                  {data?.authorAvatarUrl ? (
                    <img src={data.authorAvatarUrl} alt={data.authorName} className="w-4 h-4 rounded-full object-cover ring-1 ring-slate-200" />
                  ) : null}
                  <span>Bởi <strong>{data?.authorName || 'Cộng đồng'}</strong></span>
                </span>
                <span>•</span>
                <span>{data?.itemCount || 0} từ</span>
                <span>•</span>
                <span className="text-emerald-700 font-medium flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  {data?.forkCount || 0} lượt lưu
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              <span>Đang tải thông tin bộ từ...</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs">
              {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* Description */}
              {data.description && (
                <div className="p-3 bg-surface-subtle border border-slate-200/80 rounded-lg text-slate-700 leading-relaxed">
                  {data.description}
                </div>
              )}

              {/* CEFR Level distribution */}
              {data.cefrStats && Object.keys(data.cefrStats).length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2">Phân bố cấp độ CEFR</h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Object.entries(data.cefrStats).map(([lvl, count]) => (
                      <span
                        key={lvl}
                        className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80"
                      >
                        {lvl}: <span className="text-brand-primary">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Words Preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-slate-700">
                    Từ vựng trong bộ ({data.sampleWords?.length || 0} từ hiển thị)
                  </h4>
                  <span className="text-[11px] text-text-secondary">
                    Tất cả từ sẽ được nạp vào chu kỳ FSRS khi lưu
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-lg overflow-hidden bg-white">
                  {data.sampleWords?.map((word, idx) => (
                    <div
                      key={word.id || idx}
                      className="p-3 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <AudioButton
                          text={word.word || ''}
                          dialect={word.dialect || settings.englishDialect}
                          size="sm"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-brand-ink text-sm">
                              {word.word}
                            </span>
                            <span className="text-slate-400 font-mono text-[11px]">
                              {word.phonetic}
                            </span>
                            <span className="italic text-[10px] text-slate-500">
                              ({word.partOfSpeech})
                            </span>
                          </div>
                          <p className="font-medium text-brand-ink mt-0.5">
                            {word.meaningVi}
                          </p>
                          {word.exampleEn && (
                            <p className="text-slate-500 text-[11px] mt-0.5 italic">
                              "{word.exampleEn}"
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0">
                        {word.cefr || 'unknown'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-surface-subtle flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-control font-medium text-slate-600 hover:bg-white transition-colors text-xs"
          >
            Đóng
          </button>

          <button
            type="button"
            disabled={loading || forking || forkSuccess}
            onClick={handleFork}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-control font-bold text-xs shadow-xs transition-all ${
              forkSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-brand-primary hover:bg-brand-primaryHover text-white active:scale-95'
            }`}
          >
            {forkSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Đã lưu vào bộ từ!</span>
              </>
            ) : forking ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang nhập dữ liệu...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Lưu về bộ từ của tôi ({data?.itemCount || 0} từ)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
