import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LearnerDataControls } from '@/components/learner/LearnerDataControls';
import {
  BACKUP_ERRORS,
  LEARNER_DATA_FORMAT,
  LEARNER_DATA_MAX_BYTES,
  LEARNER_DATA_MAX_LABEL,
  exportLearnerData,
  learnerDataFileName,
  resetLearnerData,
  serializeLearnerData,
} from '@/lib/learner-store/backup';
import { CURRICULUM_PROGRESS_KEY, META_KEY, NOTEBOOK_KEY_PREFIX, ROUTE_STORAGE_KEY, THEME_KEY } from '@/lib/learner-store/keys';
import { __resetRecordsForTests } from '@/lib/learner-store/record';
import { metaRecord } from '@/lib/learner-store/repositories/meta';
import { __resetStorageForTests } from '@/lib/learner-store/storage';

const mocks = vi.hoisted(() => ({ overImportLimit: false, importThrows: false }));

// The real backup module, with two switches: a backup too large to import again, and an import that throws.
vi.mock('@/lib/learner-store/backup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/learner-store/backup')>();
  return {
    ...actual,
    fitsImportLimit: (text: string) => !mocks.overImportLimit && actual.fitsImportLimit(text),
    importLearnerData: (...args: Parameters<typeof actual.importLearnerData>) => {
      if (mocks.importThrows) throw new Error('import failed');
      return actual.importLearnerData(...args);
    },
  };
});

const FILE_LABEL = `Choose a backup file (JSON, at most ${LEARNER_DATA_MAX_LABEL})`;

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function jsonFile(text: string, name = 'sv-uvm-guide-learning-data-2026-10-18.json'): File {
  return new File([text], name, { type: 'application/json' });
}

const downloads: { blob: Blob; fileName: string }[] = [];
let pendingBlob: Blob | null = null;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  window.localStorage.clear();
  __resetStorageForTests();
  __resetRecordsForTests();
  downloads.length = 0;
  pendingBlob = null;
  mocks.overImportLimit = false;
  mocks.importThrows = false;
  // jsdom has no object URLs and does not navigate: capture what downloadBlob would save.
  URL.createObjectURL = vi.fn((blob: Blob) => {
    pendingBlob = blob;
    return 'blob:learner-data';
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (pendingBlob) downloads.push({ blob: pendingBlob, fileName: this.download });
  });
  vi.spyOn(window, 'confirm').mockImplementation(() => true);
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  vi.spyOn(window, 'prompt').mockImplementation(() => null);
});

afterEach(() => {
  cleanup();
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function expectNoBrowserDialogs() {
  expect(window.confirm).not.toHaveBeenCalled();
  expect(window.alert).not.toHaveBeenCalled();
  expect(window.prompt).not.toHaveBeenCalled();
}

describe('LearnerDataControls: back up', () => {
  it('downloads the backup as dated JSON, then shows the date of the last backup', async () => {
    const user = userEvent.setup();
    const progress = JSON.stringify({ F1A: { completedLessons: ['index'] } });
    window.localStorage.setItem(CURRICULUM_PROGRESS_KEY, progress);
    window.localStorage.setItem(THEME_KEY, 'ocean-dark');
    render(<LearnerDataControls />);

    expect(screen.getByText('No backup downloaded from this browser yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download a backup (JSON)' }));

    expect(downloads).toHaveLength(1);
    const [{ blob, fileName }] = downloads;
    expect(fileName).toBe(learnerDataFileName());
    expect(fileName).toMatch(/^sv-uvm-guide-learning-data-\d{4}-\d{2}-\d{2}\.json$/);
    expect(blob.type).toBe('application/json');
    const content = JSON.parse(await readBlob(blob));
    expect(content).toMatchObject({ format: LEARNER_DATA_FORMAT, schemaVersion: 1, legacy: { [CURRICULUM_PROGRESS_KEY]: progress } });
    expect(JSON.stringify(content)).not.toContain('ocean-dark');

    const status = screen.getByTestId('learner-data-export-status');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveTextContent(`Backup downloaded as ${fileName}.`);
    expect(await screen.findByText(/^Last backup: /)).toBeInTheDocument();
    expect(metaRecord.read().lastExportAt).toEqual(expect.any(Number));
    expectNoBrowserDialogs();
  });

  it("warns when the backup is too large for this site to import again", async () => {
    const user = userEvent.setup();
    mocks.overImportLimit = true;
    render(<LearnerDataControls />);

    await user.click(screen.getByRole('button', { name: 'Download a backup (JSON)' }));

    expect(downloads).toHaveLength(1);
    const status = screen.getByTestId('learner-data-export-status');
    expect(status).toHaveTextContent('Backup downloaded as');
    expect(status).toHaveTextContent(`It is larger than ${LEARNER_DATA_MAX_LABEL}, so this site can't import it.`);
  });

  it('shows no date, rather than crashing, when the stored backup date is one no Date can hold', () => {
    window.localStorage.setItem(META_KEY, JSON.stringify({ v: 1, data: { schemaVersion: 1, createdAt: 1, lastExportAt: 1e300 } }));
    render(<LearnerDataControls />);
    expect(screen.getByText('No backup downloaded from this browser yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download a backup (JSON)' })).toBeInTheDocument();
  });

  it('says so when the download cannot start, and records no backup date', async () => {
    const user = userEvent.setup();
    URL.createObjectURL = undefined as unknown as typeof URL.createObjectURL;
    render(<LearnerDataControls />);

    await user.click(screen.getByRole('button', { name: 'Download a backup (JSON)' }));

    expect(screen.getByTestId('learner-data-export-status')).toHaveTextContent("This browser couldn't start the download.");
    expect(metaRecord.read().lastExportAt).toBeUndefined();
  });
});

describe('LearnerDataControls: restore', () => {
  it('previews a chosen file, changes nothing until asked, then merges it and reports the result', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(CURRICULUM_PROGRESS_KEY, JSON.stringify({ F1B: { completedLessons: ['index', 'deep-dive'] } }));
    window.localStorage.setItem(ROUTE_STORAGE_KEY, 'expert');
    const backup = serializeLearnerData(exportLearnerData({ markExported: false }));
    resetLearnerData();
    const local = JSON.stringify({ F1A: { completedLessons: ['index'] } });
    window.localStorage.setItem(CURRICULUM_PROGRESS_KEY, local);
    render(<LearnerDataControls />);

    const input = screen.getByLabelText(FILE_LABEL);
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', expect.stringContaining('application/json'));
    await user.upload(input, jsonFile(backup));

    const preview = await screen.findByRole('region', { name: /^Backup from / });
    const items = within(preview).getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual(['Lesson progress2 lessons marked done', 'Chosen routeincluded']);
    // Nothing is written until the learner chooses.
    expect(window.localStorage.getItem(CURRICULUM_PROGRESS_KEY)).toBe(local);
    expect(within(preview).getByRole('button', { name: 'Replace my data' })).toBeInTheDocument();

    await user.click(within(preview).getByRole('button', { name: 'Merge with my data' }));

    const status = screen.getByTestId('learner-data-import-status');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveTextContent('Merged the backup with the learning data in this browser.');
    expect(status).toHaveTextContent('Imported: Lesson progress, Chosen route.');
    expect(screen.queryByRole('region', { name: /^Backup from / })).not.toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(JSON.parse(window.localStorage.getItem(CURRICULUM_PROGRESS_KEY) ?? '{}')).toEqual({
      F1A: { completedLessons: ['index'] },
      F1B: { completedLessons: ['index', 'deep-dive'] },
    });
    expect(window.localStorage.getItem(ROUTE_STORAGE_KEY)).toBe('expert');
    expectNoBrowserDialogs();
  });

  it('announces that the file is being read', async () => {
    const user = userEvent.setup();
    render(<LearnerDataControls />);
    let finishReading: (text: string) => void = () => undefined;
    const file = jsonFile('{}');
    Object.defineProperty(file, 'text', { value: () => new Promise<string>((resolve) => (finishReading = resolve)) });

    await user.upload(screen.getByLabelText(FILE_LABEL), file);

    const status = screen.getByTestId('learner-data-import-status');
    expect(status).toHaveAttribute('role', 'status');
    await waitFor(() => expect(status).toHaveTextContent('Reading the file…'));
    finishReading(JSON.stringify({ format: LEARNER_DATA_FORMAT, schemaVersion: 1, records: {}, legacy: {}, recovered: {} }));
    expect(await screen.findByRole('region', { name: 'Backup contents' })).toBeInTheDocument();
    expect(status).toHaveTextContent('');
  });

  it("says a merge kept this browser's own route, without calling it a problem with the file", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(ROUTE_STORAGE_KEY, 'expert');
    window.localStorage.setItem(CURRICULUM_PROGRESS_KEY, JSON.stringify({ F1B: { completedLessons: ['index'] } }));
    const backup = serializeLearnerData(exportLearnerData({ markExported: false }));
    resetLearnerData();
    window.localStorage.setItem(ROUTE_STORAGE_KEY, 'junior');
    render(<LearnerDataControls />);

    await user.upload(screen.getByLabelText(FILE_LABEL), jsonFile(backup));
    await user.click(await screen.findByRole('button', { name: 'Merge with my data' }));

    const status = screen.getByTestId('learner-data-import-status');
    expect(status).toHaveTextContent('Imported: Lesson progress.');
    expect(status).toHaveTextContent('Kept what this browser already had for: Chosen route.');
    expect(status).not.toHaveTextContent(/skipped|couldn.t be read/);
    expect(window.localStorage.getItem(ROUTE_STORAGE_KEY)).toBe('junior');
  });

  it('imports a backup with dates no Date can hold, and still renders', async () => {
    const user = userEvent.setup();
    const now = Date.now();
    const backup = JSON.stringify({
      format: LEARNER_DATA_FORMAT,
      schemaVersion: 1,
      exportedAt: new Date(now).toISOString(),
      records: {
        [META_KEY]: { v: 1, data: { schemaVersion: 1, createdAt: 1, lastExportAt: 1e300 } },
        [`${NOTEBOOK_KEY_PREFIX}n1`]: {
          v: 1,
          data: { id: 'n1', kind: 'note', title: 'Note', body: 'Body', createdAt: now, updatedAt: 1e300 },
        },
      },
      legacy: {},
      recovered: {},
    });
    render(<LearnerDataControls />);

    await user.upload(screen.getByLabelText(FILE_LABEL), jsonFile(backup));
    await user.click(await screen.findByRole('button', { name: 'Merge with my data' }));

    expect(screen.getByTestId('learner-data-import-status')).toHaveTextContent('Imported: Notebook.');
    expect(screen.getByText('No backup downloaded from this browser yet.')).toBeInTheDocument();
    expect(metaRecord.read().lastExportAt).toBeUndefined();
  });

  it('shows an error, and keeps the controls working, when the import throws', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.localStorage.setItem(CURRICULUM_PROGRESS_KEY, JSON.stringify({ F1B: { completedLessons: ['index'] } }));
    const backup = serializeLearnerData(exportLearnerData({ markExported: false }));
    mocks.importThrows = true;
    render(<LearnerDataControls />);

    await user.upload(screen.getByLabelText(FILE_LABEL), jsonFile(backup));
    await user.click(await screen.findByRole('button', { name: 'Replace my data' }));

    expect(screen.getByTestId('learner-data-import-status')).toHaveTextContent(BACKUP_ERRORS.importFailed);
    expect(screen.getByLabelText(FILE_LABEL)).toHaveFocus();
  });

  it('replaces the data in this browser when asked to', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(CURRICULUM_PROGRESS_KEY, JSON.stringify({ F1B: { completedLessons: ['index'] } }));
    const backup = serializeLearnerData(exportLearnerData({ markExported: false }));
    resetLearnerData();
    window.localStorage.setItem(CURRICULUM_PROGRESS_KEY, JSON.stringify({ F1A: { completedLessons: ['index'] } }));
    render(<LearnerDataControls />);

    await user.upload(screen.getByLabelText(FILE_LABEL), jsonFile(backup));
    await user.click(await screen.findByRole('button', { name: 'Replace my data' }));

    expect(screen.getByTestId('learner-data-import-status')).toHaveTextContent(
      'Replaced the learning data in this browser with the backup.',
    );
    expect(JSON.parse(window.localStorage.getItem(CURRICULUM_PROGRESS_KEY) ?? '{}')).toEqual({
      F1B: { completedLessons: ['index'] },
    });
  });

  it('shows a visible error for a file that is not a backup, and offers no import', async () => {
    const user = userEvent.setup();
    render(<LearnerDataControls />);
    const input = screen.getByLabelText(FILE_LABEL);

    await user.upload(input, jsonFile('this is not json', 'notes.json'));
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(BACKUP_ERRORS.notJson);
    expect(error).toBeVisible();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
    expect(screen.queryByRole('button', { name: 'Replace my data' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Merge with my data' })).not.toBeInTheDocument();

    await user.upload(input, jsonFile(JSON.stringify({ format: 'someone-else/data', schemaVersion: 1 }), 'other.json'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(BACKUP_ERRORS.notBackup));

    const huge = jsonFile('{}', 'huge.json');
    Object.defineProperty(huge, 'size', { value: LEARNER_DATA_MAX_BYTES + 1 });
    await user.upload(input, huge);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(BACKUP_ERRORS.tooLarge));
    expect(window.localStorage.length).toBe(0);
  });

  it('says when a backup holds nothing to import, and lets the learner pick another file', async () => {
    const user = userEvent.setup();
    render(<LearnerDataControls />);
    const empty = JSON.stringify({ format: LEARNER_DATA_FORMAT, schemaVersion: 1, exportedAt: 'not a date', records: {}, legacy: {}, recovered: {} });

    await user.upload(screen.getByLabelText(FILE_LABEL), jsonFile(empty));

    const preview = await screen.findByRole('region', { name: 'Backup contents' });
    expect(preview).toHaveTextContent('This backup holds no learning data, so there is nothing to import.');
    expect(within(preview).queryByRole('button', { name: 'Replace my data' })).not.toBeInTheDocument();
    await user.click(within(preview).getByRole('button', { name: 'Choose another file' }));
    expect(screen.queryByRole('region', { name: 'Backup contents' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(FILE_LABEL)).toHaveFocus();
  });
});

describe('LearnerDataControls: delete', () => {
  it('deletes only after the inline two-step confirm, keeps the theme, and never uses window.confirm', async () => {
    const user = userEvent.setup();
    const progress = JSON.stringify({ F1A: { completedLessons: ['index'] } });
    window.localStorage.setItem(CURRICULUM_PROGRESS_KEY, progress);
    window.localStorage.setItem(THEME_KEY, 'ocean-dark');
    render(<LearnerDataControls />);

    const deleteButton = screen.getByRole('button', { name: 'Delete all learning data in this browser' });
    await user.click(deleteButton);

    const confirm = screen.getByRole('group', { name: /^Delete all learning data in this browser\? This can.t be undone/ });
    const cancel = within(confirm).getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveFocus();
    expect(within(confirm).getByRole('button', { name: 'Yes, delete everything' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete all learning data in this browser' })).not.toBeInTheDocument();

    // Step one alone deletes nothing; Cancel puts focus back.
    await user.click(cancel);
    expect(window.localStorage.getItem(CURRICULUM_PROGRESS_KEY)).toBe(progress);
    expect(screen.getByRole('button', { name: 'Delete all learning data in this browser' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Delete all learning data in this browser' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete everything' }));

    const status = screen.getByTestId('learner-data-reset-status');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveTextContent('Deleted all learning data in this browser. Your theme choice is kept.');
    expect(window.localStorage.getItem(CURRICULUM_PROGRESS_KEY)).toBeNull();
    expect(window.localStorage.getItem(THEME_KEY)).toBe('ocean-dark');
    expect(screen.getByRole('button', { name: 'Delete all learning data in this browser' })).toHaveFocus();
    expectNoBrowserDialogs();
  });

  it('labels every button with visible text', () => {
    render(<LearnerDataControls />);
    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent?.trim()).not.toBe('');
    }
  });
});

// ensure components using the legacy JSX runtime can resolve React
(globalThis as typeof globalThis & { React?: typeof React }).React = React;
