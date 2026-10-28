import { heuristicNote, structureWithClaude } from '@/src/services/anthropic';
import { discoverAccounts } from '@/src/services/discover';
import { upgradeWebAnchor } from '@/src/services/primaryAccount';
import { fetchPublicProfile, handlesInText } from '@/src/services/profiles';
import type { Platform } from '@/src/parsers/handles';
import { scoreCandidate } from '@/src/services/scorer';
import { verifyOfflineName } from '@/src/services/verify';
import { applyNetwork, onRetryableFailure, recoverStuck, type JobRow } from '@/src/services/queuePolicy';
import type { RecallRepository } from '@/src/db/repository';
import { nowIso } from '@/src/lib/time';

export interface EngineKeys {
  anthropic?: string;
  twitter?: string;
}

export async function tickJobs(repo: RecallRepository, online: boolean, keys: EngineKeys): Promise<void> {
  const now = new Date();
  for (const row of repo.jobs()) {
    const job = applyNetwork(
      recoverStuck({
        ...row,
        requires: row.requires === 'network' || row.requires === 'charging' ? row.requires : null,
        started_at: row.started_at,
        error_code: row.error_code,
      } as JobRow, now),
      online,
    );
    if (job.status !== row.status || job.started_at !== row.started_at) {
      repo.updateJob(row.id, { status: job.status, started_at: job.started_at });
    }
  }
  const ready = repo.jobs()
    .filter((job) => (job.status === 'queued' || job.status === 'failed') && (!job.next_at || job.next_at <= nowIso()))
    .filter((job) => job.requires !== 'network' || online)
    .sort((a, b) => a.priority - b.priority || a.tries - b.tries);
  const next = ready[0];
  if (!next) return;
  if ((next.kind === 'structure_note' || next.kind === 'split_huddle' || next.kind === 'decode_badge') && !repo.aiAllowed(next.kind, next.ref_id)) {
    repo.updateJob(next.id, { status: 'blocked_budget', error_detail: 'Waiting for you to allow this AI step.' });
    return;
  }
  repo.updateJob(next.id, { status: 'running', started_at: nowIso() });
  try {
    await runJob(repo, next.kind, next.ref_id, keys);
    repo.updateJob(next.id, { status: 'done', started_at: null, error_code: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed';
    const auth = message === 'auth';
    const updated = onRetryableFailure(
      { ...next, status: 'running', error_code: auth ? 'P3' : 'P1', tries: next.tries } as JobRow,
      now,
      next.tries,
    );
    repo.updateJob(next.id, {
      status: auth ? 'dead' : updated.status,
      tries: updated.tries,
      next_at: updated.next_at,
      started_at: null,
      error_code: auth ? 'P3' : 'P1',
      error_detail: message.slice(0, 240),
    });
    repo.logError(auth ? 'P3' : 'A3', message);
  }
}

async function runJob(repo: RecallRepository, kind: string, refId: string, keys: EngineKeys): Promise<void> {
  if (kind === 'enrich_anchor' || kind === 'verify_offline') {
    const handles = repo.handles(refId);
    const anchor = handles.find((handle) => handle.status === 'anchor' || handle.status === 'pending_offline' || handle.status === 'conflict');
    if (!anchor) return;
    if (anchor.platform === 'web') {
      await upgradeWebAnchor(repo, refId, keys.twitter);
      return;
    }
    const profile = await fetchPublicProfile(anchor.platform, anchor.value, keys.twitter);
    if (!profile) {
      repo.logError('A3', `No public page for ${anchor.platform}:${anchor.value}`);
      return;
    }
    if (kind === 'verify_offline') {
      const typed = anchor.typed_json ? (JSON.parse(anchor.typed_json) as { realName?: string }) : {};
      const outcome = verifyOfflineName(typed.realName ?? '', profile.displayName, true);
      const status = outcome.kind === 'match' ? 'anchor' : outcome.kind === 'conflict' ? 'conflict' : 'gone';
      repo.updateHandle(anchor.id, { status, displayName: profile.displayName, bio: profile.bio, avatarUri: profile.avatarUrl, source: profile.raw });
      if (outcome.kind === 'conflict') repo.setState(refId, 'needs_review');
      return;
    }
    repo.updateHandle(anchor.id, { displayName: profile.displayName, bio: profile.bio, avatarUri: profile.avatarUrl, followers: profile.followers, source: profile.raw });
    const person = repo.person(refId);
    const label = person?.display_name ?? '';
    const placeholder = !label || label === 'Unknown' || label.startsWith('@') || label.includes('/') || label.includes('.');
    if (person && profile.displayName && placeholder) {
      repo.updatePerson(refId, { display_name: profile.displayName, real_name: person.real_name || profile.displayName, summary: profile.bio ?? person.summary, photo_uri: profile.avatarUrl ?? person.photo_uri });
    }
    if (profile.bio) suggestFromText(repo, refId, profile.bio, true);
    if (repo.person(refId)?.state === 'stub') repo.setState(refId, 'needs_review');
    return;
  }
  if (kind === 'find_related') {
    const handles = repo.handles(refId);
    const anchor = handles.find((handle) => (handle.status === 'anchor' || handle.status === 'confirmed') && handle.platform !== 'web' && handle.platform !== 'other');
    if (!anchor) return;
    const found = await discoverAccounts(anchor.platform, anchor.value, keys.twitter);
    const person = repo.person(refId);
    if (found.anchorName && person && (!person.display_name || person.display_name === 'Unknown' || person.display_name.startsWith('@') || person.display_name.includes('.'))) {
      repo.updatePerson(refId, { display_name: found.anchorName, summary: found.anchorBio ?? person.summary });
    }
    for (const hit of found.hits) {
      repo.upsertHandle({
        personId: refId,
        platform: hit.platform,
        value: hit.value,
        url: hit.url,
        status: 'suggested',
        confidence: hit.confidence,
        evidence: { note: hit.evidence },
        displayName: hit.displayName,
        bio: hit.bio,
        source: 'discover',
      });
    }
    if (anchor.bio) suggestFromText(repo, refId, `${anchor.bio} ${anchor.display_name ?? ''}`, true);
    return;
  }
  if (kind === 'structure_note' || kind === 'split_huddle') {
    const encounter = repo.encounter(refId);
    const transcript = encounter?.transcript?.trim();
    if (!transcript) return;
    const note = keys.anthropic ? await structureWithClaude(keys.anthropic, transcript) : heuristicNote(transcript);
    if (note) repo.saveDraft(refId, note);
    return;
  }
  if (kind === 'transcribe') return;
}

function suggestFromText(repo: RecallRepository, personId: string, text: string, fromBio: boolean): void {
  const existing = new Set(repo.handles(personId).map((handle) => `${handle.platform}:${handle.value.toLowerCase()}`));
  for (const found of handlesInText(text)) {
    const key = `${found.platform}:${found.value.toLowerCase()}`;
    if (existing.has(key)) continue;
    const rejected = repo.handles(personId).some((handle) => handle.status === 'rejected' && handle.platform === found.platform && handle.value.toLowerCase() === found.value.toLowerCase());
    const other = repo.findPersonByHandle(found.platform, found.value);
    const scored = scoreCandidate({
      linkedFromConfirmedBio: fromBio,
      postedAboutEventThisWeek: false,
      nameMatch: false,
      sameCompanyDomain: false,
      avatarLooksSimilar: false,
      previouslyRejected: rejected,
      alreadyConfirmedForPersonId: other && other.id !== personId ? other.display_name : null,
    });
    if (scored.excluded) continue;
    repo.insertHandle({
      personId,
      platform: found.platform as Platform,
      value: found.value,
      status: 'suggested',
      confidence: scored.level,
      score: scored.score,
      evidence: scored.evidence,
      source: 'bio',
    });
    existing.add(key);
  }
}
