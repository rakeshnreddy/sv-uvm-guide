import wavedrom from 'wavedrom';

export interface WaveDromSignal {
  name?: string;
  wave?: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface WaveDromSource {
  signal: WaveDromSignal[];
  edge?: string[];
  config?: Record<string, unknown>;
  head?: Record<string, unknown>;
  foot?: Record<string, unknown>;
  [key: string]: unknown;
}

interface WaveDromModule {
  renderWaveElement?: (
    index: number,
    source: WaveDromSource,
    outputElement: HTMLElement,
    waveSkin?: unknown,
    notFirstSignal?: boolean,
  ) => void;
  waveSkin?: unknown;
}

const wavedromApi = wavedrom as WaveDromModule;

let nextWaveDromIndex = 0;

function isWaveDromSource(value: unknown): value is WaveDromSource {
  return Boolean(value) && typeof value === 'object' && Array.isArray((value as WaveDromSource).signal);
}

export function createWaveDromIndex(): number {
  const index = nextWaveDromIndex;
  nextWaveDromIndex += 1;
  return index;
}

export function parseWaveDromSource(source: WaveDromSource | string): WaveDromSource {
  const parsedSource = typeof source === 'string' ? parseWaveDromJson(source) : source;

  if (!isWaveDromSource(parsedSource)) {
    throw new Error('Waveform spec must be an object with a signal array.');
  }

  return parsedSource;
}

export function renderWaveDromToElement({
  index,
  source,
  outputElement,
  notFirstSignal = false,
}: {
  index: number;
  source: WaveDromSource;
  outputElement: HTMLElement;
  notFirstSignal?: boolean;
}): void {
  if (typeof wavedromApi.renderWaveElement !== 'function') {
    throw new Error('WaveDrom render API is unavailable.');
  }

  wavedromApi.renderWaveElement(
    index,
    source,
    outputElement,
    wavedromApi.waveSkin,
    notFirstSignal,
  );

  const svg = outputElement.querySelector('svg');
  if (svg) {
    svg.removeAttribute('width');
    svg.style.display = 'block';
    svg.style.height = 'auto';
    svg.style.maxWidth = 'none';
    svg.setAttribute('aria-hidden', 'true');
  }
}

function parseWaveDromJson(source: string): WaveDromSource {
  const trimmedSource = source.trim();

  if (!trimmedSource) {
    throw new Error('Waveform spec is empty.');
  }

  try {
    return JSON.parse(trimmedSource) as WaveDromSource;
  } catch {
    throw new Error('Waveform spec must be valid JSON.');
  }
}
