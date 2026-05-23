import { promises as fs } from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

export interface PolicyDoc {
  policy_id: string;
  filename: string;
  policy_title: string;
  source_url: string;
  full_text: string;
  paragraphs: string[];
}

const CORPUS_DIR = path.join(process.cwd(), 'corpus', 'policies');

const FILE_METADATA: Record<string, { policy_id: string; policy_title: string; source_url: string }> = {
  'aetna-cpb-0341-adalimumab-crohns.html': {
    policy_id: 'AETNA-CPB-0341',
    policy_title: 'Aetna Clinical Policy Bulletin 0341 — Adalimumab for Crohn\'s Disease',
    source_url: 'https://www.aetna.com/cpb/medical/data/300_399/0341.html',
  },
  'aetna-cpb-0314-ustekinumab.html': {
    policy_id: 'AETNA-CPB-0314',
    policy_title: 'Aetna Clinical Policy Bulletin 0314 — Ustekinumab',
    source_url: 'https://www.aetna.com/cpb/medical/data/300_399/0314.html',
  },
  'aetna-cpb-0712-biologics-psoriasis.html': {
    policy_id: 'AETNA-CPB-0712',
    policy_title: 'Aetna Clinical Policy Bulletin 0712 — Biologics for Psoriasis',
    source_url: 'https://www.aetna.com/cpb/medical/data/700_799/0712.html',
  },
};

let cached: PolicyDoc[] | null = null;

export async function loadCorpus(): Promise<PolicyDoc[]> {
  if (cached) return cached;
  const files = await fs.readdir(CORPUS_DIR);
  const docs: PolicyDoc[] = [];
  for (const filename of files) {
    if (!filename.endsWith('.html')) continue;
    const html = await fs.readFile(path.join(CORPUS_DIR, filename), 'utf8');
    const $ = cheerio.load(html);
    $('script, style, nav, header, footer').remove();
    const fullText = $('body').text().replace(/\s+/g, ' ').trim();
    const paragraphs = fullText
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .filter(p => p.length > 80 && p.length < 1500);
    const meta = FILE_METADATA[filename] || {
      policy_id: filename.replace('.html', '').toUpperCase(),
      policy_title: filename,
      source_url: '',
    };
    docs.push({ ...meta, filename, full_text: fullText, paragraphs });
  }
  cached = docs;
  return docs;
}

export interface PolicyRanking {
  doc: PolicyDoc;
  score: number;
  top_paragraphs: { text: string; score: number }[];
}

export async function rankPoliciesAgainst(query: string): Promise<PolicyRanking[]> {
  const docs = await loadCorpus();
  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  // Extract any 3-4 digit policy IDs from the query (e.g. "0341" from
  // "Aetna Medical Policy 0341"). A direct policy-ID match should
  // dominate naive term-frequency.
  const queryPolicyIds = (lowerQuery.match(/\b\d{3,4}\b/g) || []);

  return docs.map((doc) => {
    const text = doc.full_text.toLowerCase();

    // Normalize term-frequency score by document length so a 500KB
    // doc doesn't beat a 350KB doc on common terms alone.
    const rawScore = terms.reduce((acc, term) => acc + (text.split(term).length - 1), 0);
    const normalizedScore = (rawScore / Math.max(1, doc.full_text.length)) * 100_000;

    // Hard boost: if the query's cited policy ID appears in this doc's
    // policy_id, this is the exact-match winner.
    const policyIdHit = queryPolicyIds.some(id => doc.policy_id.toLowerCase().includes(id));
    const idBoost = policyIdHit ? 1000 : 0;

    // Soft boost: drug-class disambiguation. "adalimumab" should only
    // match the adalimumab CPB, not the ustekinumab CPB even though
    // both mention each other.
    const drugBoost = (
      (lowerQuery.includes('adalimumab') || lowerQuery.includes('humira')) &&
        doc.policy_id.toLowerCase().includes('0341') ? 200 : 0
    ) + (
      (lowerQuery.includes('ustekinumab') || lowerQuery.includes('stelara')) &&
        doc.policy_id.toLowerCase().includes('0314') ? 200 : 0
    );

    const docScore = idBoost + drugBoost + normalizedScore;

    const paragraphScores = doc.paragraphs.map((p) => {
      const lower = p.toLowerCase();
      const s = terms.reduce((acc, term) => acc + (lower.split(term).length - 1), 0);
      return { text: p, score: s };
    });
    const top = paragraphScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .filter(p => p.score > 0);

    return { doc, score: docScore, top_paragraphs: top };
  }).sort((a, b) => b.score - a.score);
}
