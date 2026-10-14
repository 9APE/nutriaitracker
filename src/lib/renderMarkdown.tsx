import React from "react";

function renderLine(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
  return parts.map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**") && part.length > 4) || (part.startsWith("__") && part.endsWith("__") && part.length > 4)) {
      return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    const italicParts = part.split(/(\*[^*\s][^*]*\*)/g);
    return italicParts.map((italicPart, iIdx) => {
      if (italicPart.length > 2 && italicPart.startsWith("*") && italicPart.endsWith("*")) {
        return <em key={`${index}-${iIdx}`}>{italicPart.slice(1, -1)}</em>;
      }
      return italicPart;
    });
  });
}

/** Strip markdown markers for plain-text contexts (titles, toasts, share text). */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1$2")
    .replace(/^\s*[*-]\s+/gm, "• ");
}

/** Minimal markdown: **bold**, *italic*, # headings and "-"/"*" bullets. */
export function renderMarkdown(text: string): React.ReactNode {
  return (text ?? "").split("\n").map((rawLine, lineIdx) => {
    const heading = rawLine.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    const bullet = rawLine.match(/^\s*[*-]\s+(.*)$/);
    const content = heading ? (
      <strong className="font-semibold">{renderLine(heading[1])}</strong>
    ) : bullet ? (
      <>
        <span aria-hidden>• </span>
        {renderLine(bullet[1])}
      </>
    ) : (
      renderLine(rawLine)
    );
    return (
      <React.Fragment key={lineIdx}>
        {lineIdx > 0 && <br />}
        {content}
      </React.Fragment>
    );
  });
}
