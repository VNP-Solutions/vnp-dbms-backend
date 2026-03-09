# External API Documentation

This folder contains documentation for the External API system that allows DASHBOARD and PARSER projects to access data from the DBMS backend.

## Documentation Files

### [EXTERNAL_API_GUIDE.md](./EXTERNAL_API_GUIDE.md)
Complete API reference and usage guide for external projects:
- Authentication and authorization
- All endpoint documentation with examples
- Access control explanation
- Security best practices
- Usage examples with curl commands

### [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
Technical implementation details:
- Architecture overview
- Files created and modified
- How the system works
- Testing instructions
- Deployment checklist

## Quick Start

### For External Project Developers

1. **Get JWT Token**
   - Authenticate with the DBMS backend
   - Store the JWT token securely

2. **Make API Requests**
   ```bash
   curl -X GET \
     'https://api.example.com/external/portfolio?project_type=DASHBOARD' \
     -H 'Authorization: Bearer YOUR_JWT_TOKEN'
   ```

3. **Include Project Type**
   - All requests must include `project_type` query parameter
   - Valid values: `DASHBOARD` or `PARSER`

### For Backend Developers

See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for:
- Code structure
- How to add new external endpoints
- Access control implementation
- Testing procedures

## Support

For questions or issues:
- Check the documentation first
- Contact: api-support@vnpsolutions.com
