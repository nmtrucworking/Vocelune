'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Download, ArrowRight, Sparkles } from 'lucide-react';
import { Deck } from '@/types';
import { api } from '@/lib/api';

export function FeaturedPublicDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<{ items: Deck[] }>('/decks/public')
      .then((res) => {
        if (active && res.items) {
          setDecks(res.items.slice(0, 6));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (decks.length === 0 && !loading) return null;

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-20 bg-slate-50/60 border-t border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primarySoft text-brand-primary text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Kho từ vựng chuẩn hóa • Dữ liệu thực từ máy chủ</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-ink tracking-tight mt-2">
              Bộ từ vựng công khai nổi bật
            </h2>
            <p className="text-sm text-text-secondary mt-1 max-w-xl">
              Được tuyển chọn kỹ lưỡng theo khung chuẩn CEFR và nhu cầu thực tế: Oxford 3000, IELTS, Business, Tech và Idioms.
            </p>
          </div>

          <Link
            href="/explore"
            className="inline-flex items-center gap-2 text-xs font-bold text-brand-primary hover:text-brand-primaryHover px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-brand-primary/40 transition-all self-start md:self-auto"
          >
            <span>Khám phá toàn bộ kho từ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Decks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="bg-surface-base border border-slate-200/90 rounded-2xl p-6 shadow-card hover:shadow-elevated transition-all flex flex-col justify-between group hover:-translate-y-0.5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-xs"
                    style={{ backgroundColor: deck.color || '#5949E8' }}
                  >
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                    {deck.topicGroup || 'Chung'}
                  </span>
                </div>

                <div>
                  <h3 className="font-extrabold text-base text-brand-ink group-hover:text-brand-primary transition-colors">
                    {deck.name}
                  </h3>
                  <p className="text-xs text-text-secondary line-clamp-2 mt-1 leading-relaxed">
                    {deck.description || 'Bộ từ vựng chuẩn hóa cho người học tiếng Anh.'}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-text-secondary font-medium">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-brand-primary bg-brand-primarySoft/40 px-2 py-0.5 rounded">
                    {deck.itemCount || 0} từ
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-700">
                    <Download className="w-3 h-3" />
                    <span>{deck.forkCount || 0} lượt lưu</span>
                  </span>
                </div>

                <Link
                  href={`/explore?search=${encodeURIComponent(deck.name)}`}
                  className="font-bold text-brand-primary hover:underline text-xs flex items-center gap-1"
                >
                  <span>Xem trước</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
