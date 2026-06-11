'use client';

import React from 'react';

/** Sentinel chars injected by ts_headline in the backend (dec-014). */
const SENTINEL_START = '\x02';
const SENTINEL_END = '\x03';

interface SearchHighlightProps {
  /** Text containing sentinel chars \x02 (start) and \x03 (end) for highlights. */
  snippet: string;
  className?: string;
}

/**
 * Renders a search snippet with highlighted terms using JSX — NOT dangerouslySetInnerHTML.
 *
 * dec-014: The backend ts_headline uses non-HTML sentinel chars (\x02/\x03).
 * This component splits on those sentinels and wraps matched segments in <b>.
 * React automatically escapes text content, so HTML in the author's text (e.g., <script>)
 * is rendered as literal text, never interpreted as markup.
 *
 * PROHIBITED: dangerouslySetInnerHTML, DOMPurify, innerHTML assignment.
 */
export function SearchHighlight({ snippet, className }: SearchHighlightProps) {
  const parts = snippet.split(new RegExp(`(${SENTINEL_START}[^${SENTINEL_END}]*${SENTINEL_END})`));

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith(SENTINEL_START) && part.endsWith(SENTINEL_END)) {
          const highlighted = part.slice(1, -1);
          return <b key={i}>{highlighted}</b>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
