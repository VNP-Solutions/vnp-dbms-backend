# VNP DBMS Backend - Documentation

Welcome to the VNP DBMS Backend documentation. This folder contains comprehensive guides for various features and implementations.

## 📁 Documentation Structure

```
docs/
├── README.md (this file)
└── role-management/
    ├── QUICK_START.md
    ├── MULTI_PROJECT_ROLE_MANAGEMENT.md
    └── IMPLEMENTATION_SUMMARY.md
```

---

## 📚 Available Documentation

### 🔐 Role Management

Documentation for the Multi-Project Role Management System that enables unified role assignments across DBMS, Dashboard, and Parser projects.

**Location:** [`role-management/`](./role-management/)

**Files:**
- **[QUICK_START.md](./role-management/QUICK_START.md)** - Get started in 5 minutes
- **[API_USAGE_GUIDE.md](./role-management/API_USAGE_GUIDE.md)** - Step-by-step API workflow with examples ⭐
- **[MULTI_PROJECT_ROLE_MANAGEMENT.md](./role-management/MULTI_PROJECT_ROLE_MANAGEMENT.md)** - Complete reference guide
- **[IMPLEMENTATION_SUMMARY.md](./role-management/IMPLEMENTATION_SUMMARY.md)** - Technical overview

**What it covers:**
- Multi-project role assignment (DBMS, Dashboard, Parser)
- Centralized role management
- Project-specific permissions
- Resource-level access control
- User invitation with project roles
- Authentication integration

**Quick Links:**
- [Getting Started →](./role-management/QUICK_START.md#-getting-started-in-5-minutes)
- [API Usage Guide →](./role-management/API_USAGE_GUIDE.md) ⭐
- [API Endpoints →](./role-management/MULTI_PROJECT_ROLE_MANAGEMENT.md#api-endpoints)
- [Integration Guide →](./role-management/MULTI_PROJECT_ROLE_MANAGEMENT.md#integration-with-dashboard-and-parser)

---

## 🎯 Quick Navigation

### I want to...

**...use the APIs via Swagger/Postman**
→ Follow [role-management/API_USAGE_GUIDE.md](./role-management/API_USAGE_GUIDE.md) ⭐

**...implement multi-project role management**
→ Start with [role-management/QUICK_START.md](./role-management/QUICK_START.md)

**...understand the role system architecture**
→ Read [role-management/MULTI_PROJECT_ROLE_MANAGEMENT.md](./role-management/MULTI_PROJECT_ROLE_MANAGEMENT.md)

**...see what was implemented**
→ Check [role-management/IMPLEMENTATION_SUMMARY.md](./role-management/IMPLEMENTATION_SUMMARY.md)

**...integrate with Dashboard or Parser**
→ Follow [Integration Guide](./role-management/MULTI_PROJECT_ROLE_MANAGEMENT.md#integration-with-dashboard-and-parser)

---

## 📖 Documentation Standards

When adding new documentation to this folder:

### Folder Structure
- Create a dedicated subfolder for each major feature/module
- Use kebab-case for folder names (e.g., `role-management`, `api-gateway`)
- Include a README.md in each subfolder if it contains multiple docs

### File Naming
- Use SCREAMING_SNAKE_CASE for main documentation files (e.g., `QUICK_START.md`, `API_REFERENCE.md`)
- Use descriptive names that indicate the content purpose
- Common file names:
  - `QUICK_START.md` - Getting started guide
  - `README.md` - Index/overview
  - `API_REFERENCE.md` - API documentation
  - `IMPLEMENTATION_SUMMARY.md` - Technical overview
  - `TROUBLESHOOTING.md` - Common issues and solutions

### Content Guidelines
- Start with a clear overview/introduction
- Include table of contents for long documents
- Use code examples liberally
- Add troubleshooting sections
- Include version and last updated date
- Use emojis sparingly for section headers (optional)

---

## 🔗 Related Resources

### Code Locations
- **Source Code:** `../src/`
- **Database Schema:** `../prisma/schema.prisma`
- **Scripts:** `../src/scripts/`
- **Tests:** `../src/**/*.spec.ts`

### External Links
- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

## 📞 Support

For questions or issues:
1. Check the relevant documentation in this folder
2. Review code comments in the source files
3. Search existing issues in the project repository
4. Consult with the development team

---

## ✨ Contributing

When adding new documentation:
1. Follow the folder structure and naming conventions
2. Include practical examples and use cases
3. Add troubleshooting sections
4. Update this README to include links to new docs
5. Keep documentation up-to-date with code changes

---

**Last Updated:** March 3, 2026  
**Maintained by:** VNP Development Team
