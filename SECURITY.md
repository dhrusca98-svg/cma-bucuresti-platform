# Security Configuration

Last verified: 23 August 2026

## Supabase RLS

### admins
- RLS: ENABLED
- Policies: none
- Direct client access: blocked

### questions
- RLS: ENABLED
- Direct SELECT for anon: blocked
- Direct SELECT for authenticated: blocked
- Questions are loaded through:
  /api/test/active
- correct_answer is never returned to the test frontend

### tests
- RLS: ENABLED
- Authenticated users can SELECT active tests only
- Policy:
  Authenticated can view active tests
- Condition:
  is_active = true

### participants
- RLS: ENABLED
- No public INSERT policy

### attempts
- RLS: ENABLED
- No public INSERT policy

### answers
- RLS: ENABLED
- No public INSERT policy

## Server-side security

Sensitive operations use:
SUPABASE_SECRET_KEY

The secret key must NEVER:
- be prefixed with NEXT_PUBLIC_
- be included in client components
- be committed to Git
- be exposed in browser requests

## Test question security

The browser does not read the questions table directly.

Flow:

Browser
→ /api/test/active
→ Supabase server-side
→ safe question data returned

Returned:
- question
- answer A
- answer B
- answer C
- answer D

Never returned before submission:
- correct_answer

## Verification

End-to-end test completed successfully:

- Login
- Active test displayed
- Test started
- Answers selected
- Refresh preserved answers
- Test submitted
- Score calculated
- Admin could view participant answers
- New test tested successfully after RLS hardening