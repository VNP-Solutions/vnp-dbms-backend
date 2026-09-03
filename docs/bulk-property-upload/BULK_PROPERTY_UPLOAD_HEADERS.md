# Bulk Property Upload Headers

This document lists all the Excel headers supported for bulk property upload via the `POST /property/import` API endpoint.

## API Endpoint

```
POST /property/import
Content-Type: multipart/form-data
Authorization: Bearer {JWT_TOKEN}
Required Permission: PROPERTY.CREATE
```

## Clearing a Field with `NULL`

An empty cell means "leave the existing value alone". To clear a field instead,
put the literal text `NULL` in the cell (case-insensitive). It applies to both
`POST /property/import` and `POST /property/bulk-update`, and it skips all the
usual parsing — a `NULL` date, number, yes/no or dropdown cell is never
validated or looked up, it just becomes empty.

Four columns can't be cleared, because the database can't store them as empty:
**Property Name**, **Property Identifier**, **Portfolio** and **Is Active**. A
`NULL` in any of those fails the row with a `<column> cannot be set to NULL`
error. **Notes** is also unaffected, since notes are appended records rather
than a field.

Cleared columns are forwarded to the scraper and the dashboard as the string
`"NULL"` in the sync request body, because both services read a missing key as
"unchanged".

## Required Headers

These columns **must** be present in your Excel file:

| Header | Description | Example |
|--------|-------------|---------|
| **Property Name** or **Property** | Unique property name | Grand Hotel Manhattan |
| **Portfolio** | Portfolio name (auto-creates if doesn't exist) | Portfolio A |

## Optional Headers - Basic Information

| Header | Description | Example | Notes |
|--------|-------------|---------|-------|
| **Property Address** or **Address** | Physical address of the property | 123 Main St, New York, NY 10001 | |
| **Card Descriptor** | Payment card descriptor | GRAND HOTEL NY | |
| **Currency** | Currency code | USD | Currently parsed but not stored |

## Optional Headers - OTA Integration

| Header | Description | Example | Data Type | Notes |
|--------|-------------|---------|-----------|-------|
| **Expedia ID** | Expedia property ID | 123456 | Integer | |
| **Expedia Status** | Expedia integration status | Active / Access Required | String | Defaults to "Access Required" |
| **Booking ID** | Booking.com property ID | 789012 | Integer | |
| **Booking Status** | Booking.com integration status | Active / Access Required | String | Defaults to "Access Required" |
| **Agoda ID** | Agoda property ID | 345678 | Integer | |
| **Agoda Status** | Agoda integration status | Active / Access Required | String | Defaults to "Access Required" |

## Optional Headers - Contact Information

| Header | Description | Example | Notes |
|--------|-------------|---------|-------|
| **Portfolio Contact Email** | Portfolio contact email | portfolio@example.com | |
| **Case Contact Email** | Case management email | cases@example.com | |
| **Property Contact Email** | Property contact email | property@example.com | |
| **New Domains Email** | New domain email address | domains@example.com | |
| **Case Management Contact** | Case management contact person | John Doe | **NEW** |
| **Access Contact** | Access contact person | Jane Smith | **NEW** |
| **Reporting Contact** | Reporting contact person | Bob Wilson | **NEW** |

## Optional Headers - OTA Processors

| Header | Description | Example | Notes |
|--------|-------------|---------|-------|
| **Expedia Processor** | Person responsible for Expedia processing | Alice Johnson | **NEW** |
| **Booking Processor** | Person responsible for Booking.com processing | Michael Brown | **NEW** |
| **Agoda Processor** | Person responsible for Agoda processing | Sarah Lee | **NEW** |

## Optional Headers - Date Range

| Header | Description | Example | Format | Notes |
|--------|-------------|---------|--------|-------|
| **From** | Start date | 2024-01-01 | YYYY-MM-DD | **NEW** |
| **To** | End date | 2024-12-31 | YYYY-MM-DD | **NEW** |

## Optional Headers - Payment Information

| Header | Description | Example | Notes |
|--------|-------------|---------|-------|
| **FP MID** | First Payments Merchant ID | 1234567890 | **NEW** |
| **Stripe Account Email** | Stripe account email | stripe@example.com | **NEW** |

## Optional Headers - OTA Credentials (Encrypted)

These fields are **automatically encrypted** upon import:

| Header | Description | Example | Encryption |
|--------|-------------|---------|------------|
| **Expedia Username** | Expedia login username | expedia_user123 | No |
| **Expedia Password** | Expedia login password | ExpediaP@ss123 | **Yes** |
| **Agoda Username** | Agoda login username | agoda_user123 | No |
| **Agoda Password** | Agoda login password | AgodaP@ss123 | **Yes** |
| **Booking Username** | Booking.com login username | booking_user123 | No |
| **Booking Password** | Booking.com login password | BookingP@ss123 | **Yes** |
| **Expedia Email Associated** | Email associated with Expedia account | expedia@hotel.com | No |

## Optional Headers - Additional Credentials (Encrypted)

| Header | Description | Example | Encryption |
|--------|-------------|---------|------------|
| **Qp Username** | QP platform username | qp_user123 | No |
| **Qp Password** | QP platform password | QpP@ss123 | **Yes** |
| **Qp Api Key** | QP API key | qp_api_key_abc123xyz | **Yes** |
| **Webmail Password** | Webmail password | WebmailP@ss123 | **Yes** |

## Complete Header List (Alphabetical)

For easy reference, here's the complete list of all supported headers in alphabetical order:

1. Access Contact
2. Address (alias for Property Address)
3. Agoda ID
4. Agoda Password
5. Agoda Processor
6. Agoda Status
7. Agoda Username
8. Booking ID
9. Booking Password
10. Booking Processor
11. Booking Status
12. Booking Username
13. Card Descriptor
14. Case Contact Email
15. Case Management Contact
16. Currency
17. Expedia Email Associated
18. Expedia ID
19. Expedia Password
20. Expedia Processor
21. Expedia Status
22. Expedia Username
23. FP MID
24. From
25. New Domains Email
26. Portfolio
27. Portfolio Contact Email
28. Property (alias for Property Name)
29. Property Address
30. Property Contact Email
31. Property Name
32. Qp Api Key
33. Qp Password
34. Qp Username
35. Reporting Contact
36. Stripe Account Email
37. To
38. Webmail Password

## Excel File Format

- **Supported formats**: `.xlsx`, `.xls`, `.csv`
- **First row**: Must contain column headers (case-insensitive matching)
- **Subsequent rows**: Property data (one property per row)

## Import Behavior

### Success Criteria
- Property name must be unique (not already exist in database)
- Portfolio will be auto-created if it doesn't exist (with default "OTA" ServiceType)
- All data is validated before import

### Portfolio Auto-Creation
If a portfolio doesn't exist in the database:
1. A new portfolio is automatically created with the specified name
2. The portfolio is assigned the default "OTA" ServiceType (auto-creates if needed)
3. The portfolio is set to `is_active: true` and `is_commissionable: false`
4. The property is then created using the newly created portfolio

### Skipping Rules
Properties will be skipped if:
1. Property name already exists
2. Error occurs during portfolio or property creation
3. Any validation error occurs

**Note**: Missing portfolios will **NOT** cause skipping - they are auto-created.

### Response Format
```json
{
  "propertiesCreated": 10,
  "credentialsCreated": 8,
  "propertiesSkipped": 2,
  "properties": [...],
  "skippedProperties": [
    {
      "name": "Hotel ABC",
      "reason": "Property already exists"
    },
    {
      "name": "Hotel XYZ",
      "reason": "Error creating portfolio: {error details}"
    }
  ]
}
```

## Security Notes

1. **Automatic Encryption**: All password and sensitive credential fields are automatically encrypted using AES-256-GCM before storage
2. **Authentication Required**: JWT token with PROPERTY.CREATE permission is required
3. **Permission-Based**: Users can only import properties to portfolios they have access to

## Example Excel Template

| Property Name | Portfolio | Property Address | Expedia ID | Expedia Status | Expedia Username | Expedia Password | Case Management Contact | Expedia Processor | From | To | FP MID | Stripe Account Email |
|--------------|-----------|------------------|------------|----------------|------------------|------------------|------------------------|-------------------|------|-----|--------|---------------------|
| Grand Hotel | Portfolio A | 123 Main St | 123456 | Active | exp_user | pass123 | John Doe | Alice Johnson | 2024-01-01 | 2024-12-31 | 1234567890 | stripe@hotel.com |
| Ocean Resort | Portfolio B | 456 Beach Rd | 789012 | Access Required | exp_user2 | pass456 | Jane Smith | Bob Wilson | 2024-06-01 | 2025-05-31 | 0987654321 | payment@resort.com |

## Testing the Import

1. Create an Excel file with at least the required headers (Property Name, Portfolio)
2. Ensure the Portfolio exists in your database
3. Send POST request to `/property/import` with the file
4. Check the response for success/failure details

## Version History

- **v1.0** - Initial implementation with basic fields
- **v2.0** (Current) - Added support for:
  - Contact fields: Case Management Contact, Access Contact, Reporting Contact
  - Processor fields: Expedia Processor, Booking Processor, Agoda Processor
  - Date range: From, To
  - Payment: FP MID, Stripe Account Email
  - Status fields: Expedia Status, Booking Status, Agoda Status

## Notes

- Headers are **case-insensitive** during parsing
- Empty cells are treated as undefined/null
- Numeric fields (IDs) are automatically converted from strings
- All passwords and sensitive credentials are encrypted using the system's encryption utility
- Default status for OTA integrations is "Access Required" if not specified
