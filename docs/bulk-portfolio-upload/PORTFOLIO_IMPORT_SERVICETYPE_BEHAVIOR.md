# Portfolio Bulk Import - Updated Behavior

## Overview

The portfolio bulk import API (`POST /portfolio/import`) has been updated with enhanced ServiceType handling to make imports more flexible and automatic.

## Key Changes

### 1. ServiceType is Optional (Defaults to "OTA")
- **Old Behavior**: Required an active ServiceType in the database or import would fail
- **New Behavior**: If ServiceType column is empty or not provided, automatically uses "OTA" as default
- If "OTA" doesn't exist in the database, it will be automatically created

### 2. Auto-Create Missing ServiceTypes
- **Old Behavior**: If a ServiceType was specified but didn't exist, the portfolio was **skipped**
- **New Behavior**: If a ServiceType is specified but doesn't exist, it is **automatically created**

### 3. Case-Insensitive Matching
- ServiceType matching is case-insensitive
- Examples that match: "OTA", "ota", "Ota", "oTa" all match the same ServiceType

## Import Rules

### Required Field
- **Portfolio Name** (or "Portfolio") - This is the only required field

### Optional Fields
All other fields are optional, including:
- **Service Type** - Defaults to "OTA" if not provided
- Active Status
- Commissionable
- Commission
- Contact Email
- Portfolio Contact Email
- Portfolio Contact Name
- Portfolio Contact Phone
- Contract Signed
- And other portfolio fields

## ServiceType Behavior Details

### Scenario 1: ServiceType Column is Empty or Not Present
```
| Portfolio Name | Service Type |
|----------------|--------------|
| Portfolio A    |              |
| Portfolio B    | (no column)  |
```

**Result**: Both portfolios will be created with ServiceType = "OTA"
- If "OTA" doesn't exist, it will be created automatically with `is_active: true`

### Scenario 2: ServiceType is Provided and Exists (Case-Insensitive)
```
| Portfolio Name | Service Type |
|----------------|--------------|
| Portfolio A    | OTA          |
| Portfolio B    | ota          |
| Portfolio C    | Ota          |
```

**Result**: All portfolios will use the existing "OTA" ServiceType (case doesn't matter)

### Scenario 3: ServiceType is Provided but Doesn't Exist
```
| Portfolio Name | Service Type  |
|----------------|---------------|
| Portfolio A    | Vacation Home |
| Portfolio B    | Corporate     |
```

**Result**: 
- "Vacation Home" ServiceType will be created automatically
- "Corporate" ServiceType will be created automatically
- Both portfolios will be created with their respective ServiceTypes
- New ServiceTypes are created with `is_active: true`

### Scenario 4: Mixed ServiceTypes
```
| Portfolio Name | Service Type  |
|----------------|---------------|
| Portfolio A    | OTA           |
| Portfolio B    |               |
| Portfolio C    | Luxury        |
```

**Result**:
- Portfolio A: Uses existing "OTA" ServiceType
- Portfolio B: Uses default "OTA" ServiceType
- Portfolio C: Creates new "Luxury" ServiceType and uses it

## API Endpoint

```http
POST /portfolio/import
Content-Type: multipart/form-data
Authorization: Bearer {JWT_TOKEN}
Required Permission: PORTFOLIO.CREATE

Body:
  file: {Excel file with portfolio data}
```

## Excel File Format

### Minimum Required Format
```excel
| Portfolio Name |
|----------------|
| Portfolio A    |
| Portfolio B    |
```

### Recommended Format with ServiceType
```excel
| Portfolio Name | Service Type |
|----------------|--------------|
| Portfolio A    | OTA          |
| Portfolio B    | Vacation     |
```

### Complete Format with All Optional Fields
```excel
| Portfolio Name | Service Type | Active Status | Commissionable | Commission | Contact Email        | Portfolio Contact Email | Portfolio Contact Name | Portfolio Contact Phone | Contract Signed |
|----------------|--------------|---------------|----------------|------------|----------------------|-------------------------|------------------------|-------------------------|-----------------|
| Portfolio A    | OTA          | Yes           | Yes            | 10         | contact@example.com  | portfolio@example.com   | John Doe               | +1-555-0100            | Yes             |
| Portfolio B    | Luxury       | Yes           | No             |            | contact2@example.com |                         |                        |                         | No              |
```

## Response Format

```json
{
  "portfoliosCreated": 3,
  "portfolios": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Portfolio A",
      "service_type_id": "507f1f77bcf86cd799439020",
      "serviceType": {
        "id": "507f1f77bcf86cd799439020",
        "type": "OTA",
        "is_active": true
      },
      "is_active": true,
      "is_commissionable": true,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "skipped_portfolios": [
    {
      "row_no": 5,
      "portfolio_name": "Duplicate Portfolio",
      "reason": "Portfolio already exists"
    }
  ]
}
```

## Skipping Rules

Portfolios will only be skipped if:

1. **Portfolio name already exists** in the database
   - Reason: "Portfolio already exists"

2. **Error during creation** (e.g., validation error, database constraint)
   - Reason: "Error: {error message}"

**Note**: Missing or invalid ServiceType will **NOT** cause skipping anymore - it will auto-create.

## ServiceType Auto-Creation Details

When a new ServiceType is automatically created:

```typescript
{
  type: "ServiceTypeName",  // As provided in Excel
  is_active: true,          // Always active
  order: N + 1              // Next available order number
}
```

The `order` field is automatically set to one more than the highest existing order to maintain proper sorting.

## Logging

The import process logs the following events:

- ✅ `Default "OTA" service type created successfully` - When OTA is auto-created
- ✅ `ServiceType "{name}" created successfully` - When a custom ServiceType is auto-created
- ✅ `Created portfolio: {name}` - When a portfolio is successfully created
- ⚠️ `Portfolio "{name}" already exists, skipping` - When duplicate is found
- ❌ `Error creating portfolio "{name}": {error}` - When creation fails

## Migration Notes

### For Existing Systems

If your system already has portfolios with different ServiceTypes:
- ✅ Nothing changes - existing portfolios remain unchanged
- ✅ New imports will work with or without ServiceType column
- ✅ Auto-creation only happens for new ServiceTypes during import

### For New Systems

If starting fresh:
- First import will auto-create "OTA" ServiceType if needed
- Any custom ServiceTypes in your Excel will be auto-created
- No need to manually create ServiceTypes before import

## Best Practices

1. **Use Consistent Naming**: While case doesn't matter, consistent naming helps with data management
   - Good: Always use "OTA" (not mixing "ota", "Ota")
   
2. **Pre-define ServiceTypes**: For frequently used types, consider creating them manually first for better control over `order` field

3. **Review Auto-Created ServiceTypes**: After bulk import, review the ServiceTypes that were auto-created to ensure they match your business logic

4. **Excel Template**: Include ServiceType column even if leaving it empty - makes future updates easier

## Example Use Cases

### Use Case 1: Simple Import (Just Names)
```excel
| Portfolio Name  |
|-----------------|
| Hotel Group A   |
| Hotel Group B   |
```
Result: Both use "OTA" ServiceType (auto-created if needed)

### Use Case 2: Mixed ServiceTypes
```excel
| Portfolio Name       | Service Type      |
|----------------------|-------------------|
| OTA Hotels          | OTA               |
| Vacation Rentals    | Vacation Home     |
| Corporate Housing   | Corporate         |
| Luxury Properties   |                   |
```
Result:
- OTA Hotels: Uses/Creates "OTA" type
- Vacation Rentals: Creates "Vacation Home" type
- Corporate Housing: Creates "Corporate" type  
- Luxury Properties: Uses default "OTA" type

### Use Case 3: Migrating from Another System
```excel
| Portfolio Name    | Service Type | Active Status | Commissionable |
|-------------------|--------------|---------------|----------------|
| Legacy Portfolio 1| Legacy-OTA   | Yes           | Yes            |
| Legacy Portfolio 2| Legacy-OTA   | Yes           | No             |
```
Result: Creates "Legacy-OTA" ServiceType automatically

## Testing

To test the new behavior:

1. **Test with empty ServiceType column**:
   ```excel
   | Portfolio Name |
   |----------------|
   | Test A         |
   ```
   Expected: Creates with "OTA" ServiceType

2. **Test with new ServiceType**:
   ```excel
   | Portfolio Name | Service Type |
   |----------------|--------------|
   | Test B         | NewType      |
   ```
   Expected: Creates "NewType" ServiceType and uses it

3. **Test case-insensitive matching**:
   ```excel
   | Portfolio Name | Service Type |
   |----------------|--------------|
   | Test C         | ota          |
   ```
   Expected: Uses existing "OTA" ServiceType (case-insensitive match)

## Troubleshooting

### Issue: Import creates too many ServiceTypes
**Solution**: Review your Excel data for typos in ServiceType column. Use consistent naming.

### Issue: Want to use existing ServiceType but new one is created
**Solution**: Check spelling and ensure case-insensitive match. The system matches by exact name (case-insensitive).

### Issue: Don't want "OTA" as default
**Solution**: Always include ServiceType column with your desired default value in the Excel file.

## Version History

- **v1.0**: Initial implementation - Required ServiceType to exist or import failed
- **v2.0** (Current): Auto-creates missing ServiceTypes, defaults to "OTA", case-insensitive matching
