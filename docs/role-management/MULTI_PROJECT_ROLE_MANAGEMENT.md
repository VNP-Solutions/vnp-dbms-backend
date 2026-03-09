# Multi-Project Role Management System

## Overview

This system implements a unified role management architecture that allows users to have different roles across multiple projects (DBMS, Dashboard, and Parser). All role assignments are managed centrally from the DBMS project.

## Architecture

### Key Concepts

1. **Project Types**: Three distinct projects in the ecosystem
   - `DBMS`: The main database management system (default project)
   - `DASHBOARD`: Dashboard application for data visualization
   - `PARSER`: Parser application for data processing

2. **Role Structure**:
   - Each user has a **primary role** in DBMS (default)
   - Users can have **project-specific roles** for Dashboard and Parser
   - Project-specific roles can differ from the DBMS role

3. **Permission Granularity**:
   - Users can be assigned `admin` role in one project
   - Users can be assigned `partial` role in another project
   - Users might have no role (no access) in a third project

## Database Schema

### New Models

#### `ProjectRole`
Defines the available projects and their base configurations.

```prisma
model ProjectRole {
  id                         String                    @id
  project_type               ProjectType               @unique
  name                       String
  description                String?
  base_user_role_id          String
  base_user_role             UserRole
  is_active                  Boolean                   @default(true)
  user_project_roles         UserProjectRole[]
}
```

#### `UserProjectRole`
Links users to specific roles in specific projects with resource-level access.

```prisma
model UserProjectRole {
  id                String       @id
  user_id           String
  project_role_id   String
  project_type      ProjectType
  user_role_id      String       // The actual role for this project
  portfolio_ids     String[]     @default([])
  subportfolio_ids  String[]     @default([])
  property_ids      String[]     @default([])
  is_active         Boolean      @default(true)
  
  user              User
  project_role      ProjectRole
  user_role         UserRole
}
```

#### Enum: `ProjectType`
```prisma
enum ProjectType {
  DBMS
  DASHBOARD
  PARSER
}
```

## API Endpoints

### Project Role Management

#### 1. Create Project Role
```http
POST /project-roles
Content-Type: application/json

{
  "project_type": "DASHBOARD",
  "name": "Dashboard Access",
  "description": "Access configuration for dashboard project",
  "base_user_role_id": "507f1f77bcf86cd799439011",
  "is_active": true
}
```

#### 2. Get All Project Roles
```http
GET /project-roles
```

#### 3. Get Project Role by ID
```http
GET /project-roles/:id
```

#### 4. Update Project Role
```http
PATCH /project-roles/:id
Content-Type: application/json

{
  "name": "Updated Dashboard Access",
  "is_active": true
}
```

#### 5. Delete Project Role
```http
DELETE /project-roles/:id
```

### User Project Role Management

#### 1. Assign Project Role to User
```http
POST /user-project-roles/assign
Content-Type: application/json

{
  "user_id": "507f1f77bcf86cd799439011",
  "project_type": "DASHBOARD",
  "user_role_id": "507f1f77bcf86cd799439012",
  "portfolio_ids": ["507f1f77bcf86cd799439013"],
  "property_ids": ["507f1f77bcf86cd799439014"]
}
```

#### 2. Get All User Project Roles
```http
GET /user-project-roles
```

#### 3. Get User's Project Roles
```http
GET /user-project-roles/user/:userId
```

#### 4. Get User's Role for Specific Project
```http
GET /user-project-roles/user/:userId/project/:projectType
```

Example:
```http
GET /user-project-roles/user/507f1f77bcf86cd799439011/project/DASHBOARD
```

#### 5. Update User Project Role
```http
PATCH /user-project-roles/:id
Content-Type: application/json

{
  "user_role_id": "507f1f77bcf86cd799439015",
  "portfolio_ids": ["507f1f77bcf86cd799439016"],
  "is_active": true
}
```

#### 6. Remove User Project Role
```http
DELETE /user-project-roles/:id
```

## User Invitation with Project Roles

### Invitation Payload

When inviting a user, you can now specify roles for multiple projects:

```json
{
  "email": "john@example.com",
  "user_role_id": "507f1f77bcf86cd799439011", // DBMS role
  "message": "Welcome to VNP!",
  "portfolio_ids": ["507f1f77bcf86cd799439012"], // DBMS portfolios
  "property_ids": ["507f1f77bcf86cd799439013"], // DBMS properties
  "role": "partial",
  "project_roles": [
    {
      "project_type": "DASHBOARD",
      "user_role_id": "507f1f77bcf86cd799439014", // Admin role for dashboard
      "portfolio_ids": ["507f1f77bcf86cd799439015"],
      "property_ids": []
    },
    {
      "project_type": "PARSER",
      "user_role_id": "507f1f77bcf86cd799439016", // Partial role for parser
      "portfolio_ids": [],
      "property_ids": ["507f1f77bcf86cd799439017"]
    }
  ]
}
```

This invitation will:
1. Create a user with `partial` role in DBMS
2. Assign `admin` role in DASHBOARD project
3. Assign `partial` role in PARSER project
4. Apply resource-level permissions for each project

## Authentication Response

After login, the auth response now includes project roles:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": {
      "id": "507f1f77bcf86cd799439012",
      "name": "Partial User",
      "description": "User with partial access",
      "is_external": false,
      "portfolio_permission": { ... },
      "property_permission": { ... }
    },
    "projectRoles": [
      {
        "project_type": "DASHBOARD",
        "user_role_id": "507f1f77bcf86cd799439013",
        "user_role": {
          "id": "507f1f77bcf86cd799439013",
          "name": "Admin",
          "description": "Full admin access",
          ...
        },
        "portfolio_ids": ["507f1f77bcf86cd799439014"],
        "property_ids": [],
        "is_active": true
      },
      {
        "project_type": "PARSER",
        "user_role_id": "507f1f77bcf86cd799439015",
        "user_role": {
          "id": "507f1f77bcf86cd799439015",
          "name": "Partial User",
          ...
        },
        "portfolio_ids": [],
        "property_ids": ["507f1f77bcf86cd799439016"],
        "is_active": true
      }
    ]
  }
}
```

## Permission Checking

### Project Context Utilities

Use the project context utilities to check permissions across projects:

```typescript
import {
  getEffectiveRole,
  hasProjectAccess,
  getProjectAccessibleResources
} from '@/common/utils/project-context.util'

// Get effective role for a user in a specific project
const dashboardRole = getEffectiveRole(user, ProjectType.DASHBOARD)

// Check if user has access to a project
const canAccessParser = hasProjectAccess(user, ProjectType.PARSER)

// Get accessible resources for a user in a project
const resources = getProjectAccessibleResources(user, ProjectType.DASHBOARD)
// Returns: { portfolio_ids: [...], subportfolio_ids: [...], property_ids: [...] }
```

### Example Permission Flow

```typescript
// In Dashboard project
const user = getCurrentUser() // Returns IUserWithProjectRole

// Check access to Dashboard
if (!hasProjectAccess(user, ProjectType.DASHBOARD)) {
  throw new ForbiddenException('No access to Dashboard')
}

// Get effective role for Dashboard
const effectiveRole = getEffectiveRole(user, ProjectType.DASHBOARD)

// Check specific permission
const canCreate = effectiveRole?.portfolio_permission?.permission_level === 'all'

// Get accessible resources
const { portfolio_ids } = getProjectAccessibleResources(user, ProjectType.DASHBOARD)
```

## Setup and Initialization

### 1. Generate Prisma Client

After updating the schema, regenerate the Prisma client:

```bash
cd vnp-dbms-backend
npx prisma generate
```

### 2. Create Database Migration

```bash
npx prisma migrate dev --name add-multi-project-role-management
```

### 3. Initialize Project Roles

Create the three project role entries (run once):

```typescript
// Initialize script or seed
await prisma.projectRole.createMany({
  data: [
    {
      project_type: ProjectType.DBMS,
      name: 'DBMS Access',
      description: 'Main database management system access',
      base_user_role_id: '<super-admin-role-id>',
      is_active: true
    },
    {
      project_type: ProjectType.DASHBOARD,
      name: 'Dashboard Access',
      description: 'Dashboard application access',
      base_user_role_id: '<super-admin-role-id>',
      is_active: true
    },
    {
      project_type: ProjectType.PARSER,
      name: 'Parser Access',
      description: 'Parser application access',
      base_user_role_id: '<super-admin-role-id>',
      is_active: true
    }
  ]
})
```

## Migration Guide

### For Existing Users

Existing users will continue to work with their DBMS roles. To assign them roles in other projects:

```http
POST /user-project-roles/assign
{
  "user_id": "<existing-user-id>",
  "project_type": "DASHBOARD",
  "user_role_id": "<role-id>",
  "portfolio_ids": [],
  "property_ids": []
}
```

### For Dashboard and Parser Projects

1. **Update Authentication**: Modify your auth middleware to include project context
2. **Use Project Context**: Implement project context utilities in permission checks
3. **Filter Resources**: Use `getProjectAccessibleResources()` to filter data based on user's project role

## Example Use Cases

### Use Case 1: Multi-Project Admin
```
User: Alice
- DBMS: Admin (full access to all portfolios)
- Dashboard: Admin (full access to analytics)
- Parser: Admin (full access to parsing operations)
```

### Use Case 2: Specialized Access
```
User: Bob
- DBMS: Partial (access to portfolios A, B)
- Dashboard: Admin (full dashboard access)
- Parser: No Access
```

### Use Case 3: Limited Contractor
```
User: Carol
- DBMS: Partial (access to property X only)
- Dashboard: No Access
- Parser: Partial (access to property X parsing)
```

## Benefits

1. **Centralized Management**: All role assignments managed from DBMS
2. **Flexible Access Control**: Different permissions per project
3. **Resource-Level Granularity**: Assign specific portfolios/properties per project
4. **Backward Compatible**: Existing DBMS users continue working unchanged
5. **Scalable**: Easy to add new projects in the future

## Security Considerations

1. **Only Super Admins** can assign project roles
2. **Project roles are validated** during assignment
3. **Active status** allows temporary disabling without deletion
4. **Invitation system** enforces role assignments during user creation
5. **JWT tokens** are project-agnostic; project context determined server-side

## Testing

Test the multi-project role system:

```bash
# 1. Create project roles
POST /project-roles

# 2. Invite user with multiple project roles
POST /user-invitations

# 3. Accept invitation
POST /user-invitations/accept/:token

# 4. Login and verify project roles in response
POST /auth/login

# 5. Verify role assignment
GET /user-project-roles/user/:userId

# 6. Update project role
PATCH /user-project-roles/:id

# 7. Remove project role
DELETE /user-project-roles/:id
```

## Troubleshooting

### Common Issues

1. **Project role not found**: Ensure ProjectRole records exist for all three project types
2. **Duplicate assignment**: Use PATCH on existing assignment instead of creating new one
3. **Missing permissions**: Check that user_role_id exists and is active
4. **Authentication issues**: Ensure auth repository includes userProjectRoles in queries

## Next Steps

1. Implement the same utilities in Dashboard and Parser backends
2. Update frontend applications to show project-specific access
3. Add audit logging for project role assignments
4. Create admin UI for managing project roles
5. Add analytics for cross-project user access patterns
