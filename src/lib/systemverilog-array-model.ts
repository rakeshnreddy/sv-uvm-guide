export const MAX_ARRAY_DIMENSIONS = 3;
export const MAX_DIMENSION_SIZE = 64;
export const MAX_VISIBLE_INSTANCES = 8_192;

export interface ArrayDimensions {
  packed: number[];
  unpacked: number[];
}

export interface ArrayInstance {
  colorIndex: number;
  logicalIndex: number;
  position: [number, number, number];
}

export interface ArrayInstanceModel {
  dimensions: ArrayDimensions;
  instances: ArrayInstance[];
  logicalInstanceCount: number;
  truncated: boolean;
}

function validateDimension(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(MAX_DIMENSION_SIZE, Math.trunc(value)));
}

function validateDimensionList(values: readonly number[]): number[] {
  const bounded = values.slice(0, MAX_ARRAY_DIMENSIONS).map(validateDimension);
  return bounded.length > 0 ? bounded : [1];
}

export function validateDimensions(dimensions: ArrayDimensions): ArrayDimensions {
  return {
    packed: validateDimensionList(dimensions.packed),
    unpacked: validateDimensionList(dimensions.unpacked),
  };
}

export function encodeArrayCoordinates(
  rawDimensions: ArrayDimensions,
  coordinates: { packed: readonly number[]; unpacked: readonly number[] },
): number | null {
  const dimensions = validateDimensions(rawDimensions);
  if (
    coordinates.packed.length !== dimensions.packed.length ||
    coordinates.unpacked.length !== dimensions.unpacked.length
  ) {
    return null;
  }

  const allDimensions = [...dimensions.unpacked, ...dimensions.packed];
  const allCoordinates = [...coordinates.unpacked, ...coordinates.packed];
  if (allCoordinates.some((coordinate, index) => (
    !Number.isInteger(coordinate) || coordinate < 0 || coordinate >= allDimensions[index]
  ))) {
    return null;
  }

  return allCoordinates.reduce(
    (logicalIndex, coordinate, index) => logicalIndex * allDimensions[index] + coordinate,
    0,
  );
}

function decodeIndex(index: number, dimensions: readonly number[]): number[] {
  const coordinates = Array(dimensions.length).fill(0) as number[];
  let remainder = index;
  for (let dimension = dimensions.length - 1; dimension >= 0; dimension -= 1) {
    coordinates[dimension] = remainder % dimensions[dimension];
    remainder = Math.floor(remainder / dimensions[dimension]);
  }
  return coordinates;
}

export function buildArrayInstances(
  rawDimensions: ArrayDimensions,
  instanceCap = MAX_VISIBLE_INSTANCES,
  requiredLogicalIndex: number | null = null,
): ArrayInstanceModel {
  const dimensions = validateDimensions(rawDimensions);
  const allDimensions = [...dimensions.unpacked, ...dimensions.packed];
  const logicalInstanceCount = allDimensions.reduce((total, value) => total * value, 1);
  const visibleCount = Math.min(logicalInstanceCount, Math.max(0, Math.trunc(instanceCap)));
  const logicalIndices = Array.from({ length: visibleCount }, (_, logicalIndex) => logicalIndex);
  if (
    visibleCount > 0 &&
    Number.isInteger(requiredLogicalIndex) &&
    requiredLogicalIndex !== null &&
    requiredLogicalIndex >= visibleCount &&
    requiredLogicalIndex < logicalInstanceCount
  ) {
    logicalIndices[visibleCount - 1] = requiredLogicalIndex;
  }
  const instances = logicalIndices.map((logicalIndex) => {
    const coordinates = decodeIndex(logicalIndex, allDimensions);
    const unpackedCoordinates = coordinates.slice(0, dimensions.unpacked.length);
    const packedCoordinates = coordinates.slice(dimensions.unpacked.length);
    const packedX = packedCoordinates.at(-1) ?? 0;
    const packedY = packedCoordinates.at(-2) ?? 0;
    const packedZ = packedCoordinates.at(-3) ?? 0;
    const groupX = (unpackedCoordinates.at(-1) ?? 0) * (dimensions.packed.at(-1)! + 2);
    const groupY = (unpackedCoordinates.at(-2) ?? 0) * ((dimensions.packed.at(-2) ?? 1) + 2);
    const groupZ = (unpackedCoordinates.at(-3) ?? 0) * ((dimensions.packed.at(-3) ?? 1) + 2);
    return {
      logicalIndex,
      colorIndex: unpackedCoordinates.reduce((sum, value, index) => sum + value * (index + 1), 0) % 8,
      position: [groupX + packedX, groupY + packedY, groupZ + packedZ] as [number, number, number],
    };
  });

  return {
    dimensions,
    instances,
    logicalInstanceCount,
    truncated: logicalInstanceCount > visibleCount,
  };
}

export function createQueueIdAllocator() {
  let current = 0;
  return { next: () => ++current };
}
