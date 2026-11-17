// The history import's pure half: what to summarize again and how to keep the store small.
// The half that touches $ (listing, awk, the store) lives in register.tsx, since a
// hooks module may only hand $ to functions declared in its own file.

import type { StoredSummary } from './history'

export const FILES_KEY = 'files'

export type FileRef = { path: string; size: number; mtime: number }

/**
 * One unit of import. `key` is relative to the projects folder ("<project>/<session>.jsonl",
 * or "<project>/<session>/subagents" for all of a session's subagent transcripts), so the
 * store never holds an absolute path.
 */
export type Candidate = { key: string; paths: string[]; sid: string; isSub: boolean; size: number; mtime: number }

export function subCandidate(key: string, files: readonly FileRef[]): Candidate {
  return {
    key,
    paths: files.map(f => f.path),
    sid: '',
    isSub: true,
    size: files.reduce((a, f) => a + f.size, 0),
    mtime: files.reduce((a, f) => Math.max(a, f.mtime), 0),
  }
}

/** Candidates whose stored summary is missing or was made from another size or mtime; newest first. */
export function changed(all: readonly Candidate[], stored: Readonly<Record<string, StoredSummary>>): Candidate[] {
  return all
    .filter(c => {
      const s = stored[c.key]
      return !s || s.size !== c.size || s.mtime !== c.mtime
    })
    .sort((a, b) => b.mtime - a.mtime)
}

/**
 * Makes room when the store nears its 4 MiB: drops entries that count nothing (unreadable
 * or empty transcripts) and then entries whose session ended more than `keepDays` ago.
 */
export function compactStored(stored: Record<string, StoredSummary>, nowSec: number, keepDays = 400): void {
  const cutoff = nowSec - keepDays * 86_400
  for (const [key, s] of Object.entries(stored)) {
    const isEmpty = s.n === 0 && s.u === 0
    if (isEmpty || (s.t1 > 0 && s.t1 < cutoff)) delete stored[key]
  }
}
