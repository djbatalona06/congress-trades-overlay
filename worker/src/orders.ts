import type { ExecOrder } from '../../lib/types';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One document of the Federal Register `documents.json` response; null when unusable. */
export function parseOrder(doc: unknown): (ExecOrder & { abstract: string }) | null {
  const d = doc as Record<string, unknown> | null;
  if (!d || typeof d !== 'object') return null;

  const { document_number, title, publication_date, html_url } = d;
  if (typeof document_number !== 'string' || typeof title !== 'string') return null;
  if (typeof publication_date !== 'string' || !DAY.test(publication_date)) return null;
  if (typeof html_url !== 'string' || !html_url.startsWith('https://')) return null;

  const eoNumber = Number(d.executive_order_number);
  const signing = d.signing_date;
  return {
    document_number,
    number: Number.isInteger(eoNumber) && eoNumber > 0 ? eoNumber : null,
    title: title.trim(),
    signing_date: typeof signing === 'string' && DAY.test(signing) ? signing : null,
    publication_date,
    url: html_url,
    abstract: typeof d.abstract === 'string' ? d.abstract.trim() : '',
  };
}
