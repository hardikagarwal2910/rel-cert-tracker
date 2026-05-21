import { sanitiseError } from '@/lib/security/sanitise-error';
import type { OcrResult } from '@/types/database';

interface ExtractedFields {
  cert_number: string | null;
  expiry_date: string | null;
  issuing_body: string | null;
  cert_holder_name: string | null;
}

interface ExtractResult {
  available: boolean;
  cert_number: string | null;
  expiry_date: string | null;       // YYYY-MM-DD format
  issuing_body: string | null;
  cert_holder_name: string | null;
  confidence: 'high' | 'medium' | 'low';
}

const SYSTEM_PROMPT = `You are a certificate OCR extraction assistant.
Extract these fields from the certificate image and return ONLY valid JSON with no other text:
{ "cert_number": string|null, "expiry_date": "YYYY-MM-DD"|null, "issuing_body": string|null, "cert_holder_name": string|null }.
If a field is not found, return null.`;

export async function extractCertFields(
  imageBase64: string
): Promise<ExtractResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return unavailable();

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64,
              },
            },
            { type: 'text', text: 'Extract the certificate fields as JSON.' },
          ],
        },
      ],
    });

    const text =
      response.content[0]?.type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return unavailable();

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ExtractedFields>;
    return {
      available: true,
      cert_number: parsed.cert_number ?? null,
      expiry_date: parsed.expiry_date ?? null,
      issuing_body: parsed.issuing_body ?? null,
      cert_holder_name: parsed.cert_holder_name ?? null,
      confidence: 'high', // will be recalculated by compareCertFields
    };
  } catch (err) {
    // Sanitise BEFORE logging — ensure sk-ant- is never in logs
    const safe = sanitiseError(err);
    console.error('[ocr] extractCertFields failed:', safe);
    return unavailable();
  }
}

function unavailable(): ExtractResult {
  return {
    available: false,
    cert_number: null,
    expiry_date: null,
    issuing_body: null,
    cert_holder_name: null,
    confidence: 'low',
  };
}

function normalise(s: string | null | undefined): string {
  if (!s) return '';
  return s.toLowerCase().replace(/[\s\-]/g, '');
}

function datesWithinOneDayTolerance(
  a: string | null,
  b: string | null
): boolean {
  if (!a || !b) return false;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.abs(da - db) <= 24 * 60 * 60 * 1000;
}

export function compareCertFields(
  extracted: ExtractResult,
  submitted: {
    cert_number?: string | null;
    expiry_date?: string | null;
    issuing_body?: string | null;
  }
): OcrResult {
  if (!extracted.available) {
    return {
      available: false,
      cert_number: null,
      expiry_date: null,
      issuing_body: null,
      cert_holder_name: null,
      confidence: null,
      flagged: false,
    };
  }

  const certMatch =
    normalise(extracted.cert_number) === normalise(submitted.cert_number);
  const expiryMatch = datesWithinOneDayTolerance(
    extracted.expiry_date,
    submitted.expiry_date ?? null
  );
  const issuingMatch = submitted.issuing_body
    ? normalise(extracted.issuing_body).includes(normalise(submitted.issuing_body)) ||
      normalise(submitted.issuing_body).includes(normalise(extracted.issuing_body))
    : false;

  const matchCount = [certMatch, expiryMatch, issuingMatch].filter(Boolean).length;
  const confidence: 'high' | 'medium' | 'low' =
    matchCount === 3 ? 'high' : matchCount === 2 ? 'medium' : 'low';
  const flagged = !certMatch || !expiryMatch || !issuingMatch;

  return {
    available: true,
    cert_number: extracted.cert_number,
    expiry_date: extracted.expiry_date,
    issuing_body: extracted.issuing_body,
    cert_holder_name: extracted.cert_holder_name,
    confidence,
    flagged,
    cert_number_match: certMatch,
    expiry_date_match: expiryMatch,
    issuing_body_match: issuingMatch,
  };
}
