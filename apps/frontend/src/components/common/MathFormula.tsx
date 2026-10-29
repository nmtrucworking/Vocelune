'use client';

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathFormulaProps {
  math: string;
  displayMode?: boolean;
  className?: string;
}

export function MathFormula({ math, displayMode = false, className = '' }: MathFormulaProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode,
        throwOnError: false,
      });
    } catch {
      return math;
    }
  }, [math, displayMode]);

  return (
    <span
      className={`inline-block select-none ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
