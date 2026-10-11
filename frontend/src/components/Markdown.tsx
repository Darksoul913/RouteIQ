import { useMemo } from 'react';
import { Marked } from 'marked';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Model output is untrusted: raw HTML in it is shown as text, never rendered.
const md = new Marked({ gfm: true, breaks: false });
md.use({
  renderer: {
    html: (raw: string) => esc(raw),
    link: (href: string, title: string | null | undefined, text: string) =>
      /^(https?:|mailto:|#)/i.test(href ?? '')
        ? `<a href="${esc(href)}" target="_blank" rel="noreferrer noopener"${title ? ` title="${esc(title)}"` : ''}>${text}</a>`
        : text,
  },
});

/** Splits a leading <think>…</think> reasoning trace from the answer body. */
export function splitThink(text: string) {
  const m = text.match(/^\s*<think>([\s\S]*?)<\/think>\s*/);
  return m ? { think: m[1].trim(), body: text.slice(m[0].length) } : { think: null, body: text };
}

export default function Markdown({ text }: { text: string }) {
  const html = useMemo(() => md.parse(text) as string, [text]);
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
