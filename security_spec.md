# Security Specification - UGC NET Mock Practice App

## Data Invariants
1. A Question must have exactly 4 options (A, B, C, D) and one correct answer which must be one of the four.
2. Admins are the only users who can perform write operations (create, update, delete) on questions and categories.
3. Users can read questions and categories without authentication.

## The "Dirty Dozen" Payloads
1. **Unauthorized Create**: A non-admin user trying to create a question.
2. **Shadow Field Injection**: Adding a `isVerified` field to a question document.
3. **ID Poisoning**: Using a 2KB string as a question ID.
4. **Invalid Correct Answer**: Setting `correctAnswer` to 'E'.
5. **Missing Option**: Creating a question without 'Option D'.
6. **Type Mismatch**: Setting `createdAt` as a string instead of a server timestamp.
7. **Admin Spoofing**: A user trying to add themselves to the `admins` collection.
8. **PII Leak**: (N/A for this app, but we prevent reading admin emails if not an admin).
9. **Blanket Write**: Trying to delete the entire questions collection.
10. **State Shortcut**: (N/A for this app, no complex workflow).
11. **Massive String**: Injecting a 1MB string into the question text.
12. **Self-Promotion**: A user updating their own profile to include an admin role (if we had profiles).

## Test Cases
Tested via `firestore.rules.test.ts` (conceptual):
- `create /questions` by Unauthenticated: DENIED
- `create /questions` by Authenticated (Non-Admin): DENIED
- `create /questions` by Admin with valid schema: ALLOWED
- `get /questions` by Unauthenticated: ALLOWED
- `update /admins` by anyone: DENIED
