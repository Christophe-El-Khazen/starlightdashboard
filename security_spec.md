# Firestore Security Specification

## Data Invariants
- Every document in `venues`, `staff`, and `events` must have a valid string `id`.
- `events` must belong to a valid `venueId`.
- Users must be authenticated to perform any operation.

## The Dirty Dozen (Test Cases)
1. Unauthenticated read: `PERMISSION_DENIED`
2. Unauthenticated write: `PERMISSION_DENIED`
3. Event creation without title: `PERMISSION_DENIED`
4. Event creation with oversized title (>500 chars): `PERMISSION_DENIED`
5. Event update changing `id`: `PERMISSION_DENIED`
6. Venue creation with invalid ID pattern: `PERMISSION_DENIED`
7. Staff member creation without phone: `PERMISSION_DENIED`
8. Event creation with future-dated `updatedAt` (if used, though we use request.time): `PERMISSION_DENIED`
9. Deleting a venue by non-authenticated user: `PERMISSION_DENIED`
10. Listing events by non-authenticated user: `PERMISSION_DENIED`
11. Injecting malicious keys in Event document: `PERMISSION_DENIED`
12. Unverified email write (if strict verification enabled): `PERMISSION_DENIED`

## Security Rules Draft (DRAFT_firestore.rules)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }

    function isSignedIn() {
      return request.auth != null;
    }

    function isValidId(id) {
      return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    match /venues/{venueId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && isValidId(venueId) && isValidVenue(request.resource.data);
      allow update: if isSignedIn() && isValidVenue(request.resource.data) && request.resource.data.id == resource.data.id;
      allow delete: if isSignedIn();
    }

    function isValidVenue(data) {
      return data.keys().hasAll(['id', 'name', 'address', 'capacity']) &&
             data.id is string && data.name is string && data.name.size() <= 200 &&
             data.address is string && data.address.size() <= 500 &&
             data.capacity is number;
    }

    match /staff/{staffId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && isValidId(staffId) && isValidStaff(request.resource.data);
      allow update: if isSignedIn() && isValidStaff(request.resource.data) && request.resource.data.id == resource.data.id;
      allow delete: if isSignedIn();
    }

    function isValidStaff(data) {
      return data.keys().hasAll(['id', 'firstName', 'defaultRole', 'phone']) &&
             data.id is string && data.firstName is string && data.firstName.size() <= 100 &&
             data.defaultRole is string && data.phone is string;
    }

    match /events/{eventId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && isValidId(eventId) && isValidEvent(request.resource.data);
      allow update: if isSignedIn() && isValidEvent(request.resource.data) && request.resource.data.id == resource.data.id;
      allow delete: if isSignedIn();
    }

    function isValidEvent(data) {
      return data.keys().hasAll(['id', 'title', 'date', 'venueId']) &&
             data.id is string && data.title is string && data.title.size() <= 200 &&
             data.date is string && data.venueId is string;
    }
  }
}
```
