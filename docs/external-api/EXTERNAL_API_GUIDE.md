# External API Documentation

## Overview

The External API module provides secure endpoints for external projects (DASHBOARD and PARSER) to access data from the DBMS backend. All endpoints require:

1. **JWT Authentication** - Valid access token
2. **Project Role** - User must have an active project role for the requested project type
3. **Resource Access** - User must have access to the specific resources (portfolios, properties, subportfolios)

## Authentication

All external API endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Project Role Requirements

Users must have one of the following project roles assigned:
- **DASHBOARD** - For dashboard application access
- **PARSER** - For parser application access

Project roles are assigned by administrators and define:
- Which project type the user can access
- Which portfolios/subportfolios/properties are accessible
- The user role that determines permissions

## Base URL

All external API endpoints are prefixed with `/external/`

## Endpoints

### Portfolio APIs

#### Get All Portfolios

```
GET /external/portfolio?project_type={DASHBOARD|PARSER}&is_active={true|false}&include_credentials={true|false}
```

**Query Parameters:**
- `project_type` (required): `DASHBOARD` or `PARSER`
- `is_active` (optional): Filter by active status
- `include_credentials` (optional): Include decrypted credentials (default: false)

**Response:**
```json
[
  {
    "id": "portfolio_id",
    "name": "Portfolio Name",
    "service_type": "OTA",
    "is_active": true,
    "contact_email": "contact@example.com",
    "portfolio_contact_email": "portfolio@example.com",
    "is_commissionable": true,
    "sales_agent": "Agent Name",
    "access_email": "access@example.com",
    "access_phone": "+1234567890",
    "total_properties": 10,
    "total_subportfolios": 3,
    "credentials": [ // Only if include_credentials=true
      {
        "id": "credential_id",
        "portfolio_id": "portfolio_id",
        "credential_type": "login",
        "url": "https://example.com",
        "username": "user@example.com",
        "password": "decrypted_password", // Automatically decrypted
        "email": "user@example.com",
        "phone_number": "+1234567890",
        "notes": "Additional notes",
        "is_active": true
      }
    ]
  }
]
```

#### Get Portfolio by ID

```
GET /external/portfolio/:id?project_type={DASHBOARD|PARSER}&include_credentials={true|false}
```

**Path Parameters:**
- `id` (required): Portfolio ID

**Query Parameters:**
- `project_type` (required): `DASHBOARD` or `PARSER`
- `include_credentials` (optional): Include decrypted credentials (default: true)

**Response:** Same structure as above (single portfolio object)

---

### Property APIs

#### Get All Properties

```
GET /external/property?project_type={DASHBOARD|PARSER}&portfolio_id={id}&subportfolio_id={id}&is_active={true|false}
```

**Query Parameters:**
- `project_type` (required): `DASHBOARD` or `PARSER`
- `portfolio_id` (optional): Filter by portfolio
- `subportfolio_id` (optional): Filter by subportfolio
- `is_active` (optional): Filter by active status

**Response:**
```json
[
  {
    "id": "property_id",
    "name": "Property Name",
    "address": "123 Main St",
    "city": "City Name",
    "portfolio_id": "portfolio_id",
    "portfolio_name": "Portfolio Name",
    "subportfolio_id": "subportfolio_id",
    "subportfolio_name": "Subportfolio Name",
    "currency_id": "currency_id",
    "currency_code": "USD",
    "is_active": true,
    "notes": "Property notes"
  }
]
```

#### Get Property by ID

```
GET /external/property/:id?project_type={DASHBOARD|PARSER}
```

**Path Parameters:**
- `id` (required): Property ID

**Query Parameters:**
- `project_type` (required): `DASHBOARD` or `PARSER`

**Response:** Same structure as above (single property object)

#### Get Properties by Portfolio

```
GET /external/property/portfolio/:portfolioId?project_type={DASHBOARD|PARSER}
```

**Path Parameters:**
- `portfolioId` (required): Portfolio ID

**Query Parameters:**
- `project_type` (required): `DASHBOARD` or `PARSER`

**Response:** Array of properties

#### Get Properties by Subportfolio

```
GET /external/property/subportfolio/:subportfolioId?project_type={DASHBOARD|PARSER}
```

**Path Parameters:**
- `subportfolioId` (required): Subportfolio ID

**Query Parameters:**
- `project_type` (required): `DASHBOARD` or `PARSER`

**Response:** Array of properties

---

### Subportfolio APIs

#### Get All Subportfolios

```
GET /external/subportfolio?project_type={DASHBOARD|PARSER}&portfolio_id={id}
```

**Query Parameters:**
- `project_type` (required): `DASHBOARD` or `PARSER`
- `portfolio_id` (optional): Filter by portfolio

**Response:**
```json
[
  {
    "id": "subportfolio_id",
    "name": "Subportfolio Name",
    "portfolio_id": "portfolio_id",
    "portfolio_name": "Portfolio Name",
    "description": "Description text",
    "is_active": true,
    "total_properties": 5
  }
]
```

#### Get Subportfolio by ID

```
GET /external/subportfolio/:id?project_type={DASHBOARD|PARSER}
```

**Path Parameters:**
- `id` (required): Subportfolio ID

**Query Parameters:**
- `project_type` (required): `DASHBOARD` or `PARSER`

**Response:** Same structure as above (single subportfolio object)

#### Get Subportfolios by Portfolio

```
GET /external/subportfolio/portfolio/:portfolioId?project_type={DASHBOARD|PARSER}
```

**Path Parameters:**
- `portfolioId` (required): Portfolio ID

**Query Parameters:**
- `project_type` (required): `DASHBOARD` or `PARSER`

**Response:** Array of subportfolios

---

## Access Control

### Resource-Level Access

Users can have one of two access levels:

1. **All Access** (`'all'`)
   - User can access all resources of the specified type
   - No filtering applied based on IDs

2. **Partial Access** (specific IDs)
   - User can only access resources in their assigned list
   - Access is controlled by:
     - `portfolio_ids`: List of accessible portfolio IDs
     - `subportfolio_ids`: List of accessible subportfolio IDs
     - `property_ids`: List of accessible property IDs

### Credential Decryption

Portfolio credentials are automatically decrypted when requested:

- Credentials are encrypted in the database using AES-256-CBC
- Decryption happens server-side before returning the response
- Only users with portfolio access can retrieve credentials
- Passwords are never stored or transmitted in plain text except in the API response

**Security Note:** Only request credentials when absolutely necessary, and handle them securely in your client application.

---

## Error Responses

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Access denied. Required project role: DASHBOARD or PARSER"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Portfolio not found or access denied"
}
```

---

## Usage Examples

### Example 1: Get All Portfolios with Credentials (Dashboard)

```bash
curl -X GET \
  'https://api.example.com/external/portfolio?project_type=DASHBOARD&include_credentials=true' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Example 2: Get Properties in a Specific Portfolio (Parser)

```bash
curl -X GET \
  'https://api.example.com/external/property/portfolio/PORTFOLIO_ID?project_type=PARSER' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

### Example 3: Get Active Properties Only

```bash
curl -X GET \
  'https://api.example.com/external/property?project_type=DASHBOARD&is_active=true' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

---

## Implementation Notes

### For DASHBOARD Project

The dashboard application should:
1. Store the JWT token securely
2. Include `project_type=DASHBOARD` in all requests
3. Handle credential data securely
4. Implement proper error handling for 403/404 responses

### For PARSER Project

The parser application should:
1. Store the JWT token securely
2. Include `project_type=PARSER` in all requests
3. Request credentials only when needed for parsing operations
4. Cache data appropriately to minimize API calls

---

## Security Best Practices

1. **Token Management**
   - Store JWT tokens securely (encrypted storage, secure cookies)
   - Implement token refresh logic
   - Never expose tokens in logs or client-side code

2. **Credential Handling**
   - Only request credentials when absolutely necessary
   - Never log or persist decrypted credentials
   - Implement proper memory cleanup after using credentials

3. **Access Validation**
   - Always validate that the returned data matches expected resources
   - Handle 403 errors gracefully (user doesn't have access)
   - Implement retry logic with exponential backoff

4. **Data Caching**
   - Cache non-sensitive data to reduce API calls
   - Implement cache invalidation strategies
   - Never cache credential data

---

## Support

For questions or issues with the External API:
- Contact: api-support@vnpsolutions.com
- Documentation: https://docs.vnpsolutions.com/external-api
