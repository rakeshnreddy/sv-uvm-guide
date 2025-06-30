## Conceptual Firestore Security Rules for sv-uvm-guide

These rules are conceptual and would need to be adapted and tested in a real Firebase project's Firestore security rules editor.

```firestore
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Users Collection
    // Users can only read and write their own document.
    // User documents are keyed by their Firebase Auth UID.
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Sub-collection for user progress (e.g., completed topics, flashcard progress)
      // Users can only read and write their own progress data.
      match /progress/{topicId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /flashcardProgress/{deckId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // Potentially other user-specific sub-collections like exercise scores
      match /exerciseScores/{exerciseId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }

    // Public Content (e.g., Topic definitions, if stored in Firestore and not part of the static build)
    // Assuming topic content is largely public or managed via admin roles.
    // For simplicity, allow read for authenticated users. Write access would be restricted (e.g., to admin SDK).
    match /topics/{topicId} {
      allow read: if request.auth != null;
      allow write: if false; // Placeholder: No client-side writes, managed by admin/backend
    }

    match /resources/{resourceId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // General principle: Deny all by default unless explicitly allowed.
    // match /{document=**} {
    //   allow read, write: if false;
    // }
  }
}
```

**Key Concepts Illustrated:**

1.  **`request.auth.uid`**: This is the core of user-specific data access. It ensures that a logged-in user can only access documents where the `userId` in the path matches their own UID.
2.  **User Profile Data (`/users/{userId}`):**
    *   Each user has a document in the `users` collection, identified by their `userId`.
    *   They can read and write their own profile information.
3.  **User-Specific Sub-collections:**
    *   Data like `progress`, `flashcardProgress`, `exerciseScores` are stored in sub-collections under the user's document. This keeps user-specific data neatly organized and scoped by the parent user document's rules.
4.  **Public/Shared Content (Example: `/topics/{topicId}`):**
    *   If some content (like topic definitions, resources) were stored in Firestore (as opposed to being part of the static site build), rules would define who can read/write it.
    *   The example allows any authenticated user to read topics but restricts client-side writes (implying content is managed via a backend/admin process).
5.  **Default Deny:** While not explicitly shown with a catch-all `match /{document=**}`, Firestore rules are default-deny. If no rule matches a path, access is denied.

**Considerations for a Real Implementation:**

*   **Admin Roles:** For managing content like topics or resources, you'd typically implement an admin role system. Admin users would have broader write permissions, often managed through custom claims on their Firebase Auth tokens.
*   **Data Validation:** Real Firestore rules should include `request.resource.data` checks to validate the structure and content of data being written (e.g., ensuring a `progress` field is a number, a `completedAt` field is a timestamp).
*   **Granular Access:** Depending on complexity, rules can get more granular (e.g., allowing users to create but not delete certain records, or update only specific fields).
*   **Testing:** Firebase provides an emulator suite and a rules playground in the console for thorough testing of these rules.

This conceptual outline provides a good starting point for securing user data in Firestore for this application.
