// Module-level in-memory store for CallResults keyed by call/conversation ID.
// ElevenLabs fires the post-call webhook asynchronously (~when the user hangs
// up). The frontend polls the status endpoint until the result arrives.
//
// For the hackathon demo this in-memory map is sufficient. Production would
// back this with Firestore so multiple Cloud Run instances see the same state.

import type { CallResult } from '@/lib/schemas';

type StoredResult = {
  result: CallResult;
  receivedAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __callStore: Map<string, StoredResult> | undefined;
}

const store = globalThis.__callStore ?? (globalThis.__callStore = new Map());

export function rememberCallResult(key: string, result: CallResult) {
  store.set(key, { result, receivedAt: Date.now() });
  // Also index by call_sid + conversation_id for flexible lookup
  if (result.call_sid && result.call_sid !== key) {
    store.set(result.call_sid, { result, receivedAt: Date.now() });
  }
  if (result.conversation_id && result.conversation_id !== key) {
    store.set(result.conversation_id, { result, receivedAt: Date.now() });
  }
}

export function recallCallResult(key: string): CallResult | null {
  const stored = store.get(key);
  return stored?.result ?? null;
}

export function callStoreSize(): number {
  return store.size;
}
