/**
 * Lab progress, one key per lab version: 'sv-uvm-guide:lab:<labId>@<labVersion>'.
 *
 * This is the data contract only. The lab store (src/lib/lab-progress-store.ts)
 * owns the behaviour: autosave changes only fileBuffers, currentStepId and
 * updatedAt through update(fn), and it enforces LAB_FILE_MAX_CHARS and
 * LAB_TOTAL_MAX_CHARS before writing.
 */
import { LAB_KEY_PREFIX } from '../keys';
import {
  defineKeyedRecord,
  isNonEmptyString,
  isPlainObject,
  isTimestamp,
  recordOf,
  stringArray,
  timestampOr,
} from '../record';
import { safeStorage } from '../storage';

/** Longest content of one editable file, in characters. */
export const LAB_FILE_MAX_CHARS = 128_000;
/** Longest serialized lab record, in characters. */
export const LAB_RECORD_MAX_CHARS = 256_000;
/** Most characters all lab records together may hold. */
export const LAB_TOTAL_MAX_CHARS = 1_000_000;

export type LabStepEvidence =
  | {
      kind: 'graded';
      graderId: string;
      graderVersion: string;
      stepVersion: string;
      /** Epoch ms. */
      recordedAt: number;
      /** 'browser' evidence is re-graded on the server when accounts import it. */
      origin: 'browser' | 'server';
    }
  | {
      kind: 'self_attested';
      stepVersion: string;
      recordedAt: number;
    };

export type LabRecordStatus = 'in_progress' | 'completed';

export interface LabProgressRecord {
  labId: string;
  labVersion: string;
  currentStepId: string | null;
  completedSteps: string[];
  stepEvidence: Record<string, LabStepEvidence>;
  /** Editable file path to the learner's content. */
  fileBuffers: Record<string, string>;
  status: LabRecordStatus;
  /** Epoch ms. */
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}

/** The keyed-record id of a lab version: `${labId}@${labVersion}`. */
export function labRecordId(labId: string, labVersion: string): string {
  return `${labId}@${labVersion}`;
}

/** Splits a lab record id at its last '@'; null when either part is empty. */
export function parseLabRecordId(id: string): { labId: string; labVersion: string } | null {
  const at = id.lastIndexOf('@');
  if (at <= 0 || at === id.length - 1) return null;
  return { labId: id.slice(0, at), labVersion: id.slice(at + 1) };
}

function parseEvidence(value: unknown): LabStepEvidence | null {
  if (!isPlainObject(value)) return null;
  const stepVersion = isNonEmptyString(value.stepVersion) ? value.stepVersion : null;
  const recordedAt = isTimestamp(value.recordedAt) ? value.recordedAt : null;
  if (stepVersion === null || recordedAt === null) return null;
  if (value.kind === 'self_attested') return { kind: 'self_attested', stepVersion, recordedAt };
  if (value.kind === 'graded') {
    if (!isNonEmptyString(value.graderId) || !isNonEmptyString(value.graderVersion)) return null;
    if (value.origin !== 'browser' && value.origin !== 'server') return null;
    return {
      kind: 'graded',
      graderId: value.graderId,
      graderVersion: value.graderVersion,
      stepVersion,
      recordedAt,
      origin: value.origin,
    };
  }
  return null;
}

/** Validates a stored lab record, dropping malformed fields. Null without a lab id and version, or when they do not match `id`. */
export function parseLabProgressRecord(data: unknown, id?: string): LabProgressRecord | null {
  if (!isPlainObject(data)) return null;
  if (!isNonEmptyString(data.labId) || !isNonEmptyString(data.labVersion)) return null;
  if (id !== undefined && labRecordId(data.labId, data.labVersion) !== id) return null;
  const completedSteps = stringArray(data.completedSteps);
  const stepEvidence = recordOf(data.stepEvidence, parseEvidence);
  const fileBuffers = recordOf(data.fileBuffers, (content) =>
    typeof content === 'string' && content.length <= LAB_FILE_MAX_CHARS ? content : null,
  );
  const startedAt = timestampOr(data.startedAt, 0);
  const updatedAt = timestampOr(data.updatedAt, startedAt);
  const completedAt = isTimestamp(data.completedAt) ? data.completedAt : undefined;
  const status: LabRecordStatus =
    data.status === 'completed' || data.status === 'in_progress'
      ? data.status
      : completedAt !== undefined
        ? 'completed'
        : 'in_progress';
  const record: LabProgressRecord = {
    labId: data.labId,
    labVersion: data.labVersion,
    currentStepId: isNonEmptyString(data.currentStepId) ? data.currentStepId : null,
    completedSteps,
    stepEvidence,
    fileBuffers,
    status,
    startedAt,
    updatedAt,
  };
  if (completedAt !== undefined) record.completedAt = completedAt;
  return record;
}

function newerEvidence(a: LabStepEvidence | undefined, b: LabStepEvidence | undefined): LabStepEvidence | undefined {
  if (!a) return b;
  if (!b) return a;
  // Server-graded evidence outranks browser checks and self-attestation for the same step.
  const rank = (evidence: LabStepEvidence) => (evidence.kind === 'graded' && evidence.origin === 'server' ? 1 : 0);
  if (rank(a) !== rank(b)) return rank(a) > rank(b) ? a : b;
  return b.recordedAt > a.recordedAt ? b : a;
}

/**
 * Merges two records of the same lab version: completed steps and evidence
 * are combined, and the workspace (file buffers and current step) comes from
 * the record updated most recently.
 */
export function mergeLabProgress(local: LabProgressRecord, incoming: LabProgressRecord): LabProgressRecord {
  const newer = incoming.updatedAt > local.updatedAt ? incoming : local;
  const completedSteps = [...new Set([...local.completedSteps, ...incoming.completedSteps])];
  const stepEvidence: Record<string, LabStepEvidence> = {};
  for (const stepId of new Set([...Object.keys(local.stepEvidence), ...Object.keys(incoming.stepEvidence)])) {
    const evidence = newerEvidence(local.stepEvidence[stepId], incoming.stepEvidence[stepId]);
    if (evidence) stepEvidence[stepId] = evidence;
  }
  const completedTimes = [local.completedAt, incoming.completedAt].filter((value): value is number => value !== undefined);
  const status: LabRecordStatus =
    local.status === 'completed' || incoming.status === 'completed' ? 'completed' : 'in_progress';
  const startedTimes = [local.startedAt, incoming.startedAt].filter((value) => value > 0);
  const merged: LabProgressRecord = {
    labId: local.labId,
    labVersion: local.labVersion,
    currentStepId: newer.currentStepId,
    completedSteps,
    stepEvidence,
    fileBuffers: { ...newer.fileBuffers },
    status,
    startedAt: startedTimes.length > 0 ? Math.min(...startedTimes) : 0,
    updatedAt: Math.max(local.updatedAt, incoming.updatedAt),
  };
  if (completedTimes.length > 0) merged.completedAt = Math.min(...completedTimes);
  return merged;
}

export const labProgressRecords = defineKeyedRecord<LabProgressRecord>({
  prefix: LAB_KEY_PREFIX,
  version: 1,
  parse: (data, id) => parseLabProgressRecord(data, id),
  maxChars: LAB_RECORD_MAX_CHARS,
  merge: mergeLabProgress,
});

/** Stored lab records, newest updatedAt first; only one lab's versions when `labId` is given. */
export function listLabRecords(labId?: string): LabProgressRecord[] {
  return labProgressRecords
    .list()
    .map((entry) => entry.value)
    .filter((record) => labId === undefined || record.labId === labId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Characters every stored lab record takes (raw values), optionally leaving one record out; compare with LAB_TOTAL_MAX_CHARS. */
export function totalLabRecordChars(exceptId?: string): number {
  let total = 0;
  for (const key of safeStorage.keys(LAB_KEY_PREFIX)) {
    if (exceptId !== undefined && key === labProgressRecords.keyFor(exceptId)) continue;
    total += safeStorage.get(key)?.length ?? 0;
  }
  return total;
}
