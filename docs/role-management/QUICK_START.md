# Quick Start Guide - Multi-Project Role Management

## 🚀 Getting Started in 5 Minutes

### Step 1: Run Database Migration (1 min)

```bash
cd vnp-dbms-backend
npx prisma generate
npx prisma migrate dev --name add-multi-project-role-management
```

### Step 2: Initialize Project Roles (1 min)

```bash
npx ts-node src/scripts/init-project-roles.ts
```

**Expected Output:**
```
Initializing project roles...
✓ DBMS project role created/updated
✓ DASHBOARD project role created/updated
✓ PARSER project role created/updated

✅ Project roles initialized successfully!
```

### Step 3: Restart Backend (1 min)

```bash
npm run start:dev
```

### Step 4: Test the System (2 min)

#### A. Create a Test Invitation

```bash
curl -X POST http://localhost:3000/user-invitations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "email": "test@example.com",
    "user_role_id": "YOUR_DBMS_ROLE_ID",
    "message": "Welcome!",
    "project_roles": [
      {
        "project_type": "DASHBOARD",
        "user_role_id": "YOUR_DASHBOARD_ROLE_ID",
        "portfolio_ids": []
      }
    ]
  }'
```

#### B. Verify Project Roles

```bash
curl http://localhost:3000/project-roles \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
[
  {
    "id": "...",
    "project_type": "DBMS",
    "name": "DBMS Access",
    ...
  },
  {
    "id": "...",
    "project_type": "DASHBOARD",
    "name": "Dashboard Access",
    ...
  },
  {
    "id": "...",
    "project_type": "PARSER",
    "name": "Parser Access",
    ...
  }
]
```

## 📝 Common Operations

### Assign Project Role to Existing User

```bash
curl -X POST http://localhost:3000/user-project-roles/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "user_id": "USER_ID",
    "project_type": "DASHBOARD",
    "user_role_id": "ROLE_ID",
    "portfolio_ids": ["PORTFOLIO_ID"]
  }'
```

### Get User's Project Roles

```bash
curl http://localhost:3000/user-project-roles/user/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get User's Role for Specific Project

```bash
curl http://localhost:3000/user-project-roles/user/USER_ID/project/DASHBOARD \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Project Role Assignment

```bash
curl -X PATCH http://localhost:3000/user-project-roles/PROJECT_ROLE_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "portfolio_ids": ["NEW_PORTFOLIO_ID"],
    "is_active": true
  }'
```

### Remove Project Role

```bash
curl -X DELETE http://localhost:3000/user-project-roles/PROJECT_ROLE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔍 Checking Implementation

### Verify Database Schema

```bash
npx prisma studio
```

Look for:
- `ProjectRole` table
- `UserProjectRole` table
- `project_roles` field in `UserInvitation`

### Verify API Endpoints

```bash
# Should return 200
curl http://localhost:3000/project-roles -I \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return 200
curl http://localhost:3000/user-project-roles -I \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🐛 Troubleshooting

### Issue: Migration Fails

**Solution:**
```bash
# Reset database (CAUTION: This deletes all data)
npx prisma migrate reset

# Or manually fix conflicts in migrations
```

### Issue: Project Roles Not Found

**Solution:**
```bash
# Re-run initialization script
npx ts-node src/scripts/init-project-roles.ts
```

### Issue: Auth Response Missing projectRoles

**Solution:**
- Check that `auth.repository.ts` includes `userProjectRoles` in the user query
- Verify `auth.service.ts` maps `projectRoles` in the response

### Issue: 403 Forbidden on Project Role Endpoints

**Solution:**
- Ensure you're logged in as Super Admin
- Only Super Admins can manage project roles

## 📚 Key Concepts Recap

### Project Types
- `DBMS` - Main system (default for all users)
- `DASHBOARD` - Dashboard application
- `PARSER` - Parser application

### Role Assignment Levels
1. **User.user_role_id** - Primary DBMS role
2. **UserProjectRole** - Additional project-specific roles

### Permission Hierarchy
```
User
├── Primary Role (DBMS)
│   ├── Portfolio Permission
│   ├── Property Permission
│   └── User Permission
└── Project Roles
    ├── Dashboard Role
    │   ├── Portfolio IDs
    │   └── Property IDs
    └── Parser Role
        ├── Portfolio IDs
        └── Property IDs
```

## 🎯 Real-World Example

**Scenario:** John needs different access levels

1. **Invite John with Multi-Project Roles:**
```json
{
  "email": "john@company.com",
  "user_role_id": "partial-role-id",
  "portfolio_ids": ["port-1"],
  "project_roles": [
    {
      "project_type": "DASHBOARD",
      "user_role_id": "admin-role-id",
      "portfolio_ids": ["port-1", "port-2"]
    }
  ]
}
```

2. **John Accepts Invitation**

3. **John Logs In:**
```json
{
  "user": {
    "role": { "name": "Partial User" },
    "projectRoles": [
      {
        "project_type": "DASHBOARD",
        "user_role": { "name": "Admin" },
        "portfolio_ids": ["port-1", "port-2"]
      }
    ]
  }
}
```

4. **Dashboard Checks John's Access:**
```typescript
const effectiveRole = getEffectiveRole(user, ProjectType.DASHBOARD)
// Returns: Admin role

const resources = getProjectAccessibleResources(user, ProjectType.DASHBOARD)
// Returns: { portfolio_ids: ["port-1", "port-2"], ... }
```

## ✅ Checklist

Before considering the implementation complete:

- [ ] Migration successful
- [ ] Three project roles created (DBMS, DASHBOARD, PARSER)
- [ ] Can create user invitation with project roles
- [ ] Can assign project role to existing user
- [ ] Auth response includes projectRoles array
- [ ] Can get user's project roles via API
- [ ] Can update project role assignment
- [ ] Can remove project role assignment
- [ ] Super admin restrictions working
- [ ] API documentation reviewed

## 📖 Additional Resources

- **Full Documentation:** `MULTI_PROJECT_ROLE_MANAGEMENT.md`
- **Implementation Details:** `IMPLEMENTATION_SUMMARY.md`
- **Project Context Utils:** `../../src/common/utils/project-context.util.ts`
- **Init Script:** `../../src/scripts/init-project-roles.ts`

## 🤝 Need Help?

1. Check the troubleshooting section above
2. Review the full documentation
3. Verify all migration steps completed
4. Check server logs for errors
5. Ensure Super Admin user exists

---

**Ready to integrate with Dashboard and Parser?**  
See `MULTI_PROJECT_ROLE_MANAGEMENT.md` Section: "Integration with Dashboard and Parser"
