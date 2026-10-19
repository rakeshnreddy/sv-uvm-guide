/**
 * The learner store: typed, versioned records of learner data kept in this
 * browser (localStorage), one repository per feature.
 *
 * Nothing here imports a schema library, the auth client, the database client,
 * Node built-ins or src/server code, so it is safe in client islands. Server
 * components may import types, constants and pure helpers from it; nothing
 * here touches storage during the server render (reads return empty values
 * and writes return 'not-in-browser').
 *
 * Not re-exported, import them by path:
 * - './react' ('use client'): useRecord, useKeyedRecord, useKeyedRecordList,
 *   useStorageStatus, useHydrated.
 * - './backup': export, import and reset of learner data.
 */
import { activityRecord } from './repositories/activity';
import { assessmentRecord } from './repositories/assessments';
import { flashcardRecord } from './repositories/flashcards';
import { labProgressRecords } from './repositories/labs';
import { lessonLogRecord } from './repositories/lessons';
import { metaRecord } from './repositories/meta';
import { notebookEntries } from './repositories/notebook';
import type { KeyedLearnerRecord, LearnerRecord } from './record';

export * from './keys';
export * from './time';
export * from './storage';
export * from './record';
export * from './repositories/meta';
export * from './repositories/labs';
export * from './repositories/flashcards';
export * from './repositories/notebook';
export * from './repositories/assessments';
export * from './repositories/lessons';
export * from './repositories/activity';
export * from './repositories/legacy';

export type LearnerArea = 'meta' | 'labs' | 'flashcards' | 'notebook' | 'assessments' | 'lessons' | 'activity';

export type LearnerRecordEntry =
  | { area: LearnerArea; kind: 'record'; record: LearnerRecord<unknown> }
  | { area: LearnerArea; kind: 'keyed'; record: KeyedLearnerRecord<unknown> };

/**
 * Every versioned learner record, in a stable order, for backup and the
 * import preview to iterate. The legacy keys ('curriculumProgress', the route
 * choice and the exercise keys) are not listed: backups carry them as raw
 * strings (see repositories/legacy.ts), and curriculumProgressRecord is
 * exported for merging them.
 */
export const learnerRecords: readonly LearnerRecordEntry[] = Object.freeze([
  { area: 'meta', kind: 'record', record: metaRecord as LearnerRecord<unknown> },
  { area: 'labs', kind: 'keyed', record: labProgressRecords as KeyedLearnerRecord<unknown> },
  { area: 'flashcards', kind: 'record', record: flashcardRecord as LearnerRecord<unknown> },
  { area: 'notebook', kind: 'keyed', record: notebookEntries as KeyedLearnerRecord<unknown> },
  { area: 'assessments', kind: 'record', record: assessmentRecord as LearnerRecord<unknown> },
  { area: 'lessons', kind: 'record', record: lessonLogRecord as LearnerRecord<unknown> },
  { area: 'activity', kind: 'record', record: activityRecord as LearnerRecord<unknown> },
] satisfies LearnerRecordEntry[]);
