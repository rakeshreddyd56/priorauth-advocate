# Antigravity Hello World

Pre-event disposable smoke test for the Gemini API Managed Agents path.

The test creates two trivial managed agents on top of `antigravity-preview-05-2026`:

- `intake-smoke`: turns a denial-letter sentence into a tiny JSON payload.
- `policy-smoke`: receives that payload and responds with an administrative next-step message.

Run it from this directory:

```bash
npm install
GEMINI_API_KEY=... npm run smoke
```

Expected output is a JSON object with the created managed-agent IDs, interaction IDs, environment IDs, and the two final text outputs.

This is not production project code. It exists only to answer the stack go/no-go question before the hackathon.
