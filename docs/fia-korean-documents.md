# FIA Korean document explanations

Netlify-only feature. Main route remains the championship calculator. The documents page links to a Korean explanation tab and the existing PDF reader.

## Runtime

- `GET /api/fia-translation?file=...` reads cached explanations. No AI call.
- `POST /api/fia-translate?file=...` verifies same-origin requests and membership in the current FIA official list, downloads a bounded PDF, extracts text, translates with the OpenAI SDK, validates source excerpts and table shape, and stores the result in Netlify Blobs.
- The AI SDK uses runtime-injected `OPENAI_API_KEY` / `OPENAI_BASE_URL` from Netlify AI Gateway, or the site's own provider credentials. Never put credentials in public source or browser storage.
- Default model: `gpt-4.1-mini`, verified in Netlify's provider catalog during implementation. Override with `FIA_TRANSLATION_MODEL` only after verifying structured-output support.
- If the gateway/provider is unavailable, the UI says setup is pending and retains the original PDF and Google document translation handoff.

## Bounds

Generation is explicit, not triggered by page views. Site-wide generation endpoint limit: six requests/hour. Maximum PDF: 10 MB; automatic explanations: 15 pages / 35,000 extracted characters. Output: at most 10,000 tokens. No automatic SDK retries. Blank/scanned documents are not sent for translation. Source quotations must match extracted text; generated HTML is never inserted.

Per-document atomic attempt records reduce duplicate generation (five-minute windows). Production and preview use separate site-scoped stores. Source hashes prevent retranslating unchanged PDF bytes. After 15 minutes the UI offers an explicit source-change check; it is not a scheduled updater. Attempt records are not a financial budget ledger.

This is an AI-generated structured explanation, not a certified or necessarily complete translation. Extraction and model errors remain possible; readers can inspect source excerpts and the original PDF. No OCR is included. No MCP/ChatGPT account integration is included.

## Verification

Test actual PDF extraction, quote validation, malformed PDF paths, read-route POST rejection, PDF library bundling, deployed provider availability, a real translation, cached reread, and original PDF tab before publishing to production. Do not mark automatic translation complete if credentials or provider credit are unavailable.
