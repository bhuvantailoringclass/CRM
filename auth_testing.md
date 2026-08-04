# Auth-Gated App Testing Playbook (Emergent Google Auth)

## Step 1: Create Test User & Session (mongosh)
```
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({ user_id: userId, email: 'admin@bifd.com', name: 'Admin', role: 'admin', created_at: new Date() });
db.user_sessions.insertOne({ user_id: userId, session_token: sessionToken, expires_at: new Date(Date.now()+7*24*60*60*1000), created_at: new Date() });
print(sessionToken);
```

## Step 2: Backend API
curl -X GET "$URL/api/auth/me" -H "Authorization: Bearer <token>"
curl -X GET "$URL/api/registers/admission" -H "Authorization: Bearer <token>"

## Step 3: Browser cookie
add_cookies name=session_token, domain=<app domain>, path=/, httpOnly true, secure true, sameSite None

## Roles
- admin emails: bhuvantailoringclass@gmail.com, admin@bifd.com
- teachers: created by admin (collection `teachers`), matched by email on login.
