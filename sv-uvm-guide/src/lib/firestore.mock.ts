// Mock Firestore service

interface DocumentData {
  [key: string]: unknown; // Changed any to unknown
}

// In-memory store for our mock Firestore
const mockDb: { [collectionPath: string]: { [docId: string]: DocumentData } } = {};

const getCollectionAndDocId = (path: string): { collectionPath: string, docId: string } | null => {
  const parts = path.split('/');
  if (parts.length % 2 !== 0) {
    // console.error("Mock Firestore: Invalid path. Path must point to a document.", path);
    // For doc() it's fine, for collection() it's fine too. This check is too strict.
  }
  if (parts.length < 2) {
    console.error("Mock Firestore: Path too short.", path);
    return null;
  }
  const docId = parts.pop()!;
  const collectionPath = parts.join('/');
  return { collectionPath, docId };
};


// Simulate getDoc
export const getDocMock = (docPath: string): Promise<{ exists: () => boolean; data: () => DocumentData | undefined; id: string }> => {
  console.log(`Mock Firestore: getDoc called for path: ${docPath}`);
  return new Promise((resolve) => {
    setTimeout(() => { // Simulate network delay
      const pathInfo = getCollectionAndDocId(docPath);
      if (!pathInfo) {
        // This case should ideally not happen if docPath is always valid
        resolve({ exists: () => false, data: () => undefined, id: '' });
        return;
      }
      const { collectionPath, docId } = pathInfo;
      const doc = mockDb[collectionPath]?.[docId];

      console.log(`Mock Firestore: Document for ${docPath}:`, doc ? JSON.parse(JSON.stringify(doc)) : 'Not Found');

      resolve({
        exists: () => !!doc,
        data: () => doc ? { ...doc } : undefined, // Return a copy
        id: docId,
      });
    }, 300);
  });
};

// Simulate setDoc
export const setDocMock = (docPath: string, data: DocumentData, options?: { merge?: boolean }): Promise<void> => {
  console.log(`Mock Firestore: setDoc called for path: ${docPath} with data:`, JSON.parse(JSON.stringify(data)), "options:", options);
  return new Promise((resolve) => {
    setTimeout(() => { // Simulate network delay
      const pathInfo = getCollectionAndDocId(docPath);
      if (!pathInfo) {
        resolve(); // Or reject, depending on desired mock behavior
        return;
      }
      const { collectionPath, docId } = pathInfo;

      if (!mockDb[collectionPath]) {
        mockDb[collectionPath] = {};
      }

      if (options?.merge && mockDb[collectionPath]?.[docId]) {
        mockDb[collectionPath][docId] = { ...mockDb[collectionPath][docId], ...data };
        console.log(`Mock Firestore: Document merged at ${docPath}:`, JSON.parse(JSON.stringify(mockDb[collectionPath][docId])));
      } else {
        mockDb[collectionPath][docId] = { ...data }; // Store a copy
        console.log(`Mock Firestore: Document set at ${docPath}:`, JSON.parse(JSON.stringify(mockDb[collectionPath][docId])));
      }
      resolve();
    }, 300);
  });
};

// Simulate updateDoc (similar to setDoc with merge: true for top-level fields)
export const updateDocMock = (docPath: string, data: Partial<DocumentData>): Promise<void> => {
    console.log(`Mock Firestore: updateDoc called for path: ${docPath} with data:`, JSON.parse(JSON.stringify(data)));
    return new Promise((resolve, reject) => {
    setTimeout(() => { // Simulate network delay
      const pathInfo = getCollectionAndDocId(docPath);
      if (!pathInfo) {
        reject(new Error("Invalid document path for updateDocMock."));
        return;
      }
      const { collectionPath, docId } = pathInfo;

      if (!mockDb[collectionPath] || !mockDb[collectionPath][docId]) {
        console.error(`Mock Firestore: No document to update at ${docPath}`);
        reject(new Error(`Mock Firestore: No document to update at ${docPath}`));
        return;
      }

      // Simple merge for mock, real Firestore update is more complex for nested fields
      mockDb[collectionPath][docId] = { ...mockDb[collectionPath][docId], ...data };
      console.log(`Mock Firestore: Document updated at ${docPath}:`, JSON.parse(JSON.stringify(mockDb[collectionPath][docId])));
      resolve();
    }, 300);
  });
};


// Simulate a simple collection query (not fully featured)
export const getDocsMock = (collectionPath: string): Promise<{ docs: Array<{ id: string; data: () => DocumentData }> }> => {
  console.log(`Mock Firestore: getDocs (simple query) called for collection: ${collectionPath}`);
  return new Promise((resolve) => {
    setTimeout(() => {
      const collection = mockDb[collectionPath];
      if (!collection) {
        resolve({ docs: [] });
        return;
      }
      const docsArray = Object.entries(collection).map(([id, data]) => ({
        id,
        data: () => ({ ...data }), // Return a copy
      }));
      resolve({ docs: docsArray });
    }, 300);
  });
};


// Path helpers (not actually from Firestore but useful for constructing paths)
export const docMock = (collectionPath: string, docId: string): string => `${collectionPath}/${docId}`;
export const collectionMock = (basePath: string): string => basePath; // For simple collection paths

console.log("Using MOCK Firebase Firestore service.");

// Example usage:
// import { getDocMock as getDoc, setDocMock as setDoc } from '@/lib/firestore.mock';
// const userDocPath = docMock('users', 'someUserId');
// await setDoc(userDocPath, { name: "Test User", progress: {} });
// const userDoc = await getDoc(userDocPath);
// if (userDoc.exists()) console.log(userDoc.data());
