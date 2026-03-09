# API Usage Guide - Multi-Project Role Management

This guide provides step-by-step instructions for using the Multi-Project Role Management APIs via Swagger or any API client (Postman, cURL, etc.).

## 📋 Prerequisites

Before starting, ensure you have:
- Backend server running (`npm run start:dev`)
- Swagger UI accessible at `http://localhost:3000/api`
- Super Admin account created
- Authentication token (Bearer token)

---

## 🔐 Step 0: Authentication

### Get Your Auth Token

1. **Login as Super Admin**
   ```http
   POST /auth/login
   ```
   **Request Body:**
   ```json
   {
     "email": "admin@vnp.com",
     "password": "your-password"
   }
   ```
   
   **Response:**
   ```json
   {
     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": { ... }
   }
   ```

2. **Copy the `access_token`** from the response
3. **In Swagger:** Click "Authorize" button at the top right
4. **Enter:** `Bearer your-access-token-here`
5. **Click:** "Authorize" then "Close"

✅ You're now authenticated for all subsequent requests!

---

## 🚀 Complete Workflow: Setting Up Multi-Project Roles

### Step 1: Initialize Project Roles (One-Time Setup)

Run the initialization script:
```bash
npx ts-node src/scripts/init-project-roles.ts
```

This creates three ProjectRole entries:
- DBMS (Main system)
- DASHBOARD (Dashboard app)
- PARSER (Parser app)

**Verify by calling:**
```http
GET /project-roles
```

**Expected Response:**
```json
[
  {
    "id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "project_type": "DBMS",
    "name": "DBMS Access",
    "description": "Main database management system access",
    "is_active": true
  },
  {
    "id": "65a1b2c3d4e5f6g7h8i9j0k2",
    "project_type": "DASHBOARD",
    "name": "Dashboard Access",
    "description": "Dashboard application access",
    "is_active": true
  },
  {
    "id": "65a1b2c3d4e5f6g7h8i9j0k3",
    "project_type": "PARSER",
    "name": "Parser Access",
    "description": "Parser application access",
    "is_active": true
  }
]
```

💾 **Save these IDs** - you'll need them later!

---

### Step 2: Create User Roles for Each Project

You need to create UserRole entries that can be used across different projects.

#### 2.1 Create DBMS Admin Role

```http
POST /user-roles
```

**Request Body:**
```json
{
  "name": "DBMS Admin",
  "description": "Full administrative access to DBMS",
  "is_external": false,
  "can_access_mis": true,
  "is_active": true,
  "portfolio_permission": {
    "permission_level": "all",
    "access_level": "all"
  },
  "property_permission": {
    "permission_level": "all",
    "access_level": "all"
  },
  "audit_permission": {
    "permission_level": "all",
    "access_level": "all"
  },
  "user_permission": {
    "permission_level": "all",
    "access_level": "all"
  },
  "system_settings_permission": {
    "permission_level": "all",
    "access_level": "all"
  },
  "bank_details_permission": {
    "permission_level": "all",
    "access_level": "all"
  }
}
```

**Response:**
```json
{
  "id": "65b1c2d3e4f5g6h7i8j9k0l1",
  "name": "DBMS Admin",
  ...
}
```

💾 **Save this ID as:** `dbms_admin_role_id`

#### 2.2 Create DBMS Partial Role

```http
POST /user-roles
```

**Request Body:**
```json
{
  "name": "DBMS Partial User",
  "description": "Limited access to specific portfolios/properties",
  "is_external": false,
  "can_access_mis": false,
  "is_active": true,
  "portfolio_permission": {
    "permission_level": "update",
    "access_level": "partial"
  },
  "property_permission": {
    "permission_level": "update",
    "access_level": "partial"
  },
  "audit_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "user_permission": {
    "permission_level": "view",
    "access_level": "none"
  },
  "system_settings_permission": {
    "permission_level": "view",
    "access_level": "none"
  },
  "bank_details_permission": {
    "permission_level": "view",
    "access_level": "partial"
  }
}
```

**Response:**
```json
{
  "id": "65b1c2d3e4f5g6h7i8j9k0l2",
  "name": "DBMS Partial User",
  ...
}
```

💾 **Save this ID as:** `dbms_partial_role_id`

#### 2.3 Create Dashboard Admin Role

```http
POST /user-roles
```

**Request Body:**
```json
{
  "name": "Dashboard Admin",
  "description": "Full access to Dashboard analytics",
  "is_external": false,
  "can_access_mis": true,
  "is_active": true,
  "portfolio_permission": {
    "permission_level": "all",
    "access_level": "all"
  },
  "property_permission": {
    "permission_level": "all",
    "access_level": "all"
  },
  "audit_permission": {
    "permission_level": "all",
    "access_level": "all"
  },
  "user_permission": {
    "permission_level": "view",
    "access_level": "none"
  },
  "system_settings_permission": {
    "permission_level": "view",
    "access_level": "all"
  },
  "bank_details_permission": {
    "permission_level": "view",
    "access_level": "all"
  }
}
```

**Response:**
```json
{
  "id": "65b1c2d3e4f5g6h7i8j9k0l3",
  "name": "Dashboard Admin",
  ...
}
```

💾 **Save this ID as:** `dashboard_admin_role_id`

#### 2.4 Create Parser Partial Role

```http
POST /user-roles
```

**Request Body:**
```json
{
  "name": "Parser Partial User",
  "description": "Limited parser access",
  "is_external": false,
  "can_access_mis": false,
  "is_active": true,
  "portfolio_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "property_permission": {
    "permission_level": "update",
    "access_level": "partial"
  },
  "audit_permission": {
    "permission_level": "view",
    "access_level": "partial"
  },
  "user_permission": {
    "permission_level": "view",
    "access_level": "none"
  },
  "system_settings_permission": {
    "permission_level": "view",
    "access_level": "none"
  },
  "bank_details_permission": {
    "permission_level": "view",
    "access_level": "none"
  }
}
```

**Response:**
```json
{
  "id": "65b1c2d3e4f5g6h7i8j9k0l4",
  "name": "Parser Partial User",
  ...
}
```

💾 **Save this ID as:** `parser_partial_role_id`

---

### Step 3: Get Portfolio and Property IDs (Optional)

If you want to assign specific portfolios/properties, get their IDs:

#### 3.1 Get Portfolios

```http
GET /portfolios
```

**Response:**
```json
{
  "data": [
    {
      "id": "65c1d2e3f4g5h6i7j8k9l0m1",
      "name": "Portfolio Alpha",
      ...
    },
    {
      "id": "65c1d2e3f4g5h6i7j8k9l0m2",
      "name": "Portfolio Beta",
      ...
    }
  ]
}
```

💾 **Save portfolio IDs you want to assign**

#### 3.2 Get Properties

```http
GET /properties
```

**Response:**
```json
{
  "data": [
    {
      "id": "65d1e2f3g4h5i6j7k8l9m0n1",
      "name": "Property X",
      ...
    }
  ]
}
```

💾 **Save property IDs you want to assign**

---

### Step 4: Invite User with Multi-Project Roles

Now you can invite a user with different roles across projects!

```http
POST /user-invitations
```

**Request Body Example 1: User with Admin in DBMS, Admin in Dashboard, Partial in Parser**
```json
{
  "email": "john.doe@company.com",
  "user_role_id": "65b1c2d3e4f5g6h7i8j9k0l1",
  "message": "Welcome to VNP! You have been assigned roles across multiple projects.",
  "role": "admin",
  "portfolio_ids": [],
  "property_ids": [],
  "project_roles": [
    {
      "project_type": "DASHBOARD",
      "user_role_id": "65b1c2d3e4f5g6h7i8j9k0l3",
      "portfolio_ids": [],
      "property_ids": []
    },
    {
      "project_type": "PARSER",
      "user_role_id": "65b1c2d3e4f5g6h7i8j9k0l4",
      "portfolio_ids": [],
      "property_ids": ["65d1e2f3g4h5i6j7k8l9m0n1"]
    }
  ]
}
```

**Request Body Example 2: User with Partial in DBMS, No Dashboard, Partial in Parser**
```json
{
  "email": "jane.smith@company.com",
  "user_role_id": "65b1c2d3e4f5g6h7i8j9k0l2",
  "message": "Welcome! You have access to specific portfolios and properties.",
  "role": "partial",
  "portfolio_ids": ["65c1d2e3f4g5h6i7j8k9l0m1"],
  "property_ids": [],
  "project_roles": [
    {
      "project_type": "PARSER",
      "user_role_id": "65b1c2d3e4f5g6h7i8j9k0l4",
      "portfolio_ids": ["65c1d2e3f4g5h6i7j8k9l0m1"],
      "property_ids": []
    }
  ]
}
```

**Response:**
```json
{
  "id": "65e1f2g3h4i5j6k7l8m9n0o1",
  "email": "john.doe@company.com",
  "invitation_token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "status": "Pending",
  "expires_at": "2026-03-10T12:00:00Z",
  ...
}
```

✅ **Invitation sent!** The user will receive an email with the invitation link.

---

### Step 5: User Accepts Invitation

The invited user clicks the link in their email and accepts the invitation:

```http
POST /user-invitations/accept/{token}
```

**URL Parameter:** Use the `invitation_token` from Step 4

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "password": "SecureP@ssw0rd123!",
  "language": "en",
  "contact_number": "+1234567890"
}
```

**Response:**
```json
{
  "user": {
    "id": "65f1g2h3i4j5k6l7m8n9o0p1",
    "email": "john.doe@company.com",
    "first_name": "John",
    "last_name": "Doe",
    ...
  },
  "invitation": {
    "id": "65e1f2g3h4i5j6k7l8m9n0o1",
    "status": "Accepted",
    ...
  }
}
```

💾 **Save the user ID as:** `new_user_id`

✅ **User account created with multi-project roles!**

---

### Step 6: Verify User's Project Roles

Check what roles the user has across all projects:

```http
GET /user-project-roles/user/{new_user_id}
```

**Response:**
```json
[
  {
    "id": "660102030405060708090a0b",
    "user_id": "65f1g2h3i4j5k6l7m8n9o0p1",
    "project_type": "DASHBOARD",
    "user_role_id": "65b1c2d3e4f5g6h7i8j9k0l3",
    "user_role": {
      "id": "65b1c2d3e4f5g6h7i8j9k0l3",
      "name": "Dashboard Admin",
      ...
    },
    "portfolio_ids": [],
    "property_ids": [],
    "is_active": true
  },
  {
    "id": "660102030405060708090a0c",
    "user_id": "65f1g2h3i4j5k6l7m8n9o0p1",
    "project_type": "PARSER",
    "user_role_id": "65b1c2d3e4f5g6h7i8j9k0l4",
    "user_role": {
      "id": "65b1c2d3e4f5g6h7i8j9k0l4",
      "name": "Parser Partial User",
      ...
    },
    "portfolio_ids": [],
    "property_ids": ["65d1e2f3g4h5i6j7k8l9m0n1"],
    "is_active": true
  }
]
```

---

## 🔄 Additional Operations

### Assign Project Role to Existing User

If you need to add a project role to an existing user:

```http
POST /user-project-roles/assign
```

**Request Body:**
```json
{
  "user_id": "65f1g2h3i4j5k6l7m8n9o0p1",
  "project_type": "DASHBOARD",
  "user_role_id": "65b1c2d3e4f5g6h7i8j9k0l3",
  "portfolio_ids": ["65c1d2e3f4g5h6i7j8k9l0m1"],
  "property_ids": []
}
```

**Response:**
```json
{
  "id": "660102030405060708090a0d",
  "user_id": "65f1g2h3i4j5k6l7m8n9o0p1",
  "project_type": "DASHBOARD",
  "is_active": true,
  ...
}
```

---

### Get User's Role for Specific Project

```http
GET /user-project-roles/user/{user_id}/project/{project_type}
```

**Example:**
```http
GET /user-project-roles/user/65f1g2h3i4j5k6l7m8n9o0p1/project/DASHBOARD
```

**Response:**
```json
{
  "id": "660102030405060708090a0b",
  "project_type": "DASHBOARD",
  "user_role": {
    "name": "Dashboard Admin",
    ...
  },
  "portfolio_ids": [],
  "is_active": true
}
```

---

### Update Project Role Assignment

```http
PATCH /user-project-roles/{user_project_role_id}
```

**Request Body:**
```json
{
  "user_role_id": "65b1c2d3e4f5g6h7i8j9k0l2",
  "portfolio_ids": ["65c1d2e3f4g5h6i7j8k9l0m2"],
  "property_ids": [],
  "is_active": true
}
```

---

### Remove Project Role from User

```http
DELETE /user-project-roles/{user_project_role_id}
```

**Response:**
```json
{
  "message": "User project role removed successfully"
}
```

---

## 📊 Testing Scenarios

### Scenario 1: Multi-Project Admin

**Goal:** Create a user with admin access to all projects

1. Create invitation with:
   - `user_role_id`: Admin role for DBMS
   - `project_roles`: Array with DASHBOARD (admin) and PARSER (admin)

2. User accepts invitation

3. Verify user has admin access across all three projects

### Scenario 2: Specialized Access

**Goal:** User has partial DBMS access, admin Dashboard access, no Parser access

1. Create invitation with:
   - `user_role_id`: Partial role for DBMS
   - `portfolio_ids`: Specific portfolios for DBMS
   - `project_roles`: Only DASHBOARD with admin role

2. User accepts invitation

3. Verify user has:
   - Partial DBMS access to specified portfolios
   - Admin Dashboard access
   - No Parser access

### Scenario 3: Adding Access Later

**Goal:** Give existing user access to a new project

1. Get existing user ID

2. Call `POST /user-project-roles/assign` with new project

3. Verify new project role added

---

## 🔍 Verification Checklist

After setting up multi-project roles, verify:

- [ ] ProjectRoles exist for DBMS, DASHBOARD, PARSER (`GET /project-roles`)
- [ ] User roles created for each project (`GET /user-roles`)
- [ ] User invitation includes project_roles array
- [ ] User can accept invitation successfully
- [ ] User's project roles appear in `/user-project-roles/user/{id}`
- [ ] Login response includes `projectRoles` array
- [ ] Each project can access user's effective role

---

## 📝 Quick Reference - ID Variables

Keep track of these IDs during your workflow:

```javascript
// Project Roles (from Step 1)
const project_roles = {
  DBMS: "65a1b2c3d4e5f6g7h8i9j0k1",
  DASHBOARD: "65a1b2c3d4e5f6g7h8i9j0k2",
  PARSER: "65a1b2c3d4e5f6g7h8i9j0k3"
}

// User Roles (from Step 2)
const user_roles = {
  dbms_admin: "65b1c2d3e4f5g6h7i8j9k0l1",
  dbms_partial: "65b1c2d3e4f5g6h7i8j9k0l2",
  dashboard_admin: "65b1c2d3e4f5g6h7i8j9k0l3",
  parser_partial: "65b1c2d3e4f5g6h7i8j9k0l4"
}

// Resources (from Step 3)
const portfolios = {
  alpha: "65c1d2e3f4g5h6i7j8k9l0m1",
  beta: "65c1d2e3f4g5h6i7j8k9l0m2"
}

const properties = {
  property_x: "65d1e2f3g4h5i6j7k8l9m0n1"
}

// Users (from Step 4-5)
const users = {
  john_doe: "65f1g2h3i4j5k6l7m8n9o0p1"
}
```

---

## 🚨 Common Issues

### Issue: 401 Unauthorized

**Solution:** Your auth token expired. Go back to Step 0 and get a new token.

### Issue: 403 Forbidden

**Solution:** You're not logged in as Super Admin. Only Super Admins can manage project roles.

### Issue: 404 Not Found (project-roles)

**Solution:** Run the initialization script from Step 1.

### Issue: Invalid user_role_id

**Solution:** Double-check the role ID you're using. Run `GET /user-roles` to see all available roles.

---

## 💡 Tips

1. **Use Swagger's "Try it out"** feature for easy testing
2. **Keep a notepad** with all the IDs you generate
3. **Test with one user first** before bulk inviting
4. **Use meaningful role names** to avoid confusion
5. **Document your resource IDs** (portfolios, properties) for reference

---

**Need more help?** See [MULTI_PROJECT_ROLE_MANAGEMENT.md](./MULTI_PROJECT_ROLE_MANAGEMENT.md) for detailed documentation.
