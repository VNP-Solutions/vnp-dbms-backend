import { PaginatedResult, QueryDto } from '../dto/query.dto'

export interface QueryBuilderConfig {
  searchFields?: string[]
  filterableFields?: string[]
  sortableFields?: string[]
  defaultSortField?: string
  defaultSortOrder?: 'asc' | 'desc'
  nestedFieldMap?: Record<string, string>
}

/**
 * QueryBuilder - A reusable utility for building Prisma queries with support for:
 * - Search (with nested relation support)
 * - Filtering (with nested relation support)
 * - Sorting (with nested relation support)
 * - Pagination
 *
 * ## Nested Field Support
 *
 * The QueryBuilder supports searching, filtering, and sorting on nested relation fields
 * using dot notation. This works for relations at any depth level.
 *
 * ### Usage Examples:
 *
 * ```typescript
 * // Example 1: Basic usage with nested fields
 * const queryConfig = {
 *   searchFields: [
 *     'id',                    // Direct field
 *     'name',                  // Direct field
 *     'portfolio.name',        // Nested field (relation)
 *     'portfolio.owner.email'  // Multi-level nested field
 *   ],
 *   filterableFields: [
 *     'is_active',
 *     'portfolio_id',
 *     'portfolio.is_active'    // Can filter on nested fields too
 *   ],
 *   sortableFields: [
 *     'created_at',
 *     'name',
 *     'portfolio.name',        // Can sort by nested fields
 *     'portfolio.created_at'
 *   ],
 *   defaultSortField: 'created_at',
 *   defaultSortOrder: 'desc' as const
 * }
 *
 * // Build the query
 * const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
 *   queryDto,
 *   queryConfig,
 *   baseWhere
 * )
 *
 * // Use with Prisma
 * const results = await prisma.property.findMany({
 *   where,
 *   skip,
 *   take,
 *   orderBy,
 *   include: {
 *     portfolio: true  // Don't forget to include relations you're querying
 *   }
 * })
 * ```
 *
 * ### Example 2: Using nestedFieldMap for aliasing
 *
 * You can use `nestedFieldMap` to create aliases for nested fields:
 *
 * ```typescript
 * const queryConfig = {
 *   searchFields: ['name', 'portfolio_name'],  // Use alias
 *   sortableFields: ['created_at', 'portfolio_name'],
 *   nestedFieldMap: {
 *     portfolio_name: 'portfolio.name',  // Map alias to actual path
 *     owner_email: 'portfolio.owner.email'
 *   }
 * }
 * ```
 *
 * ### How It Works:
 *
 * When you specify 'portfolio.name' as a search field:
 * - Input: `{ search: 'Hotel' }`
 * - Output Prisma query: `{ portfolio: { name: { contains: 'Hotel', mode: 'insensitive' } } }`
 *
 * For sorting by 'portfolio.name':
 * - Input: `{ sortBy: 'portfolio.name', sortOrder: 'asc' }`
 * - Output Prisma query: `{ portfolio: { name: 'asc' } }`
 *
 * ### Important Notes:
 *
 * 1. **Include Relations**: When using nested fields, always include the relations in your Prisma query:
 *    ```typescript
 *    await prisma.model.findMany({
 *      where,
 *      include: { portfolio: true }  // Required!
 *    })
 *    ```
 *
 * 2. **Multi-level Nesting**: Supports any depth (e.g., 'portfolio.owner.company.name')
 *
 * 3. **Both Formats Supported**:
 *    - Direct dot notation: 'portfolio.name'
 *    - Mapped aliases: 'portfolio_name' → 'portfolio.name'
 *
 * 4. **Consistent Across Operations**: Same syntax works for search, filter, and sort
 *
 * @example
 * // Property service example
 * const queryConfig = {
 *   searchFields: ['id', 'name', 'portfolio.name', 'batch.batch_no'],
 *   filterableFields: ['is_active', 'portfolio_id'],
 *   sortableFields: ['name', 'created_at', 'portfolio.name']
 * }
 *
 * @example
 * // User service example
 * const queryConfig = {
 *   searchFields: ['email', 'name', 'role.name', 'department.name'],
 *   filterableFields: ['is_active', 'role_id'],
 *   sortableFields: ['name', 'created_at', 'role.name']
 * }
 */
export class QueryBuilder {
  /**
   * Check if a value should be ignored
   * Ignores: 'All', 'all', empty string, null, undefined
   */
  static shouldIgnoreValue(value: any): boolean {
    if (value === null || value === undefined || value === '') {
      return true
    }
    if (typeof value === 'string' && value.toLowerCase() === 'all') {
      return true
    }
    return false
  }

  /**
   * Check if a string is a valid MongoDB ObjectID format
   * ObjectIDs are 24 character hexadecimal strings
   */
  static isValidObjectId(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false
    }
    // MongoDB ObjectID is 24 characters long and contains only hex characters
    return /^[0-9a-fA-F]{24}$/.test(value)
  }

  /**
   * Check if a field name represents an ID field
   * Matches: 'id', '_id', or fields ending with '_id' (e.g., 'user_id', 'portfolio_id')
   */
  static isIdField(fieldName: string): boolean {
    return (
      fieldName === 'id' || fieldName === '_id' || fieldName.endsWith('_id')
    )
  }

  /**
   * Parse string value to appropriate type
   */
  static parseValue(value: any): any {
    if (this.shouldIgnoreValue(value)) {
      return undefined
    }

    // If value is already a boolean, return it as is
    if (typeof value === 'boolean') {
      return value
    }

    // Boolean string values
    if (value === 'true') return true
    if (value === 'false') return false

    // Numeric values
    if (!isNaN(Number(value)) && value !== '') {
      return Number(value)
    }

    // Array values (comma-separated) - only for string values
    if (typeof value === 'string' && value.includes(',')) {
      return value.split(',').map(v => this.parseValue(v.trim()))
    }

    return value
  }

  /**
   * Build search where clause with support for nested fields
   * Supports both direct nested notation (e.g., 'portfolio.name') and mapped fields
   */
  static buildSearchWhere(
    searchTerm: string | undefined,
    searchFields: string[],
    nestedFieldMap?: Record<string, string>
  ): any {
    if (this.shouldIgnoreValue(searchTerm) || searchFields.length === 0) {
      return {}
    }

    // Type assertion: searchTerm is guaranteed to be string after shouldIgnoreValue check
    const term = searchTerm!

    const searchConditions = searchFields
      .map(field => {
        // Skip ID fields if search term is not a valid ObjectID
        if (this.isIdField(field) && !this.isValidObjectId(term)) {
          return null
        }

        // Check if field is mapped in nestedFieldMap
        if (nestedFieldMap && nestedFieldMap[field]) {
          return this.buildNestedSearchCondition(nestedFieldMap[field], term)
        }

        // Check if field contains dot notation (direct nested field)
        if (field.includes('.')) {
          return this.buildNestedSearchCondition(field, term)
        }

        // For ID fields with valid ObjectID, use exact match instead of contains
        if (this.isIdField(field) && this.isValidObjectId(term)) {
          return {
            [field]: term
          }
        }

        // Regular field - use contains for text search
        return {
          [field]: {
            contains: term,
            mode: 'insensitive'
          }
        }
      })
      .filter(condition => condition !== null) // Remove null conditions (skipped ID fields)

    return searchConditions.length > 1
      ? { OR: searchConditions }
      : searchConditions[0] || {}
  }

  /**
   * Build nested search condition from a dot-notation field path
   * Supports multiple levels of nesting (e.g., 'portfolio.owner.name')
   */
  private static buildNestedSearchCondition(
    fieldPath: string,
    searchTerm: string
  ): any {
    const parts = fieldPath.split('.')

    // Build nested object from inside out
    let condition: any = {
      contains: searchTerm,
      mode: 'insensitive'
    }

    // Start from the last part and work backwards
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i]
      if (i === parts.length - 1) {
        // Innermost level - apply the search condition
        condition = { [part]: condition }
      } else {
        // Outer levels - wrap the existing condition
        condition = { [part]: condition }
      }
    }

    return condition
  }

  /**
   * Build filter where clause with support for nested fields
   * Supports both direct nested notation and mapped fields
   */
  static buildFilterWhere(
    filters: any,
    filterableFields: string[],
    nestedFieldMap?: Record<string, string>
  ): any {
    if (!filters || typeof filters !== 'object') {
      return {}
    }

    const filterConditions: any = {}

    for (const [key, value] of Object.entries(filters)) {
      // Skip if value should be ignored
      if (this.shouldIgnoreValue(value)) {
        continue
      }

      // Skip if field is not filterable
      if (!filterableFields.includes(key)) {
        continue
      }

      const parsedValue = this.parseFilterValue(value)

      // Check if field is mapped in nestedFieldMap
      if (nestedFieldMap && nestedFieldMap[key]) {
        this.setNestedValue(filterConditions, nestedFieldMap[key], parsedValue)
        continue
      }

      // Check if field contains dot notation (direct nested field)
      if (key.includes('.')) {
        this.setNestedValue(filterConditions, key, parsedValue)
        continue
      }

      // Regular field
      filterConditions[key] = parsedValue
    }

    return filterConditions
  }

  /**
   * Set a nested value in an object using dot notation path
   * Handles multiple levels of nesting (e.g., 'portfolio.owner.name')
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.')
    let current = obj

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!current[part]) {
        current[part] = {}
      }
      current = current[part]
    }

    current[parts[parts.length - 1]] = value
  }

  /**
   * Parse filter value with operator support
   */
  static parseFilterValue(value: any): any {
    // If value is an object with operator
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const { operator, val } = value
      const parsedVal = this.parseValue(val || value.value)

      switch (operator) {
        case 'contains':
          return { contains: parsedVal, mode: 'insensitive' }
        case 'in':
          return { in: Array.isArray(parsedVal) ? parsedVal : [parsedVal] }
        case 'gte':
          return { gte: parsedVal }
        case 'lte':
          return { lte: parsedVal }
        case 'gt':
          return { gt: parsedVal }
        case 'lt':
          return { lt: parsedVal }
        case 'not':
          return { not: parsedVal }
        default:
          return parsedVal
      }
    }

    // Simple value
    return this.parseValue(value)
  }

  /**
   * Build sort order clause with support for nested fields
   * Supports both direct nested notation and mapped fields
   */
  static buildOrderBy(
    sortBy: string | undefined,
    sortOrder: 'asc' | 'desc' | undefined,
    sortableFields: string[],
    defaultSortField: string,
    defaultSortOrder: 'asc' | 'desc',
    nestedFieldMap?: Record<string, string>
  ): any {
    // Use default if sortBy is not provided or should be ignored
    const field = this.shouldIgnoreValue(sortBy)
      ? defaultSortField
      : sortableFields.includes(sortBy!)
        ? sortBy
        : defaultSortField

    // Type assertion: order is guaranteed to be 'asc' | 'desc' after the check
    const order: 'asc' | 'desc' = this.shouldIgnoreValue(sortOrder)
      ? defaultSortOrder
      : sortOrder!

    // Check if field is mapped in nestedFieldMap
    if (nestedFieldMap && nestedFieldMap[field!]) {
      return this.buildNestedOrderBy(nestedFieldMap[field!], order)
    }

    // Check if field contains dot notation (direct nested field)
    if (field!.includes('.')) {
      return this.buildNestedOrderBy(field!, order)
    }

    return { [field!]: order }
  }

  /**
   * Build nested order by from a dot-notation field path
   * Supports multiple levels of nesting
   */
  private static buildNestedOrderBy(
    fieldPath: string,
    order: 'asc' | 'desc'
  ): any {
    const parts = fieldPath.split('.')
    let orderBy: any = order

    // Build nested object from inside out
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i]
      if (i === parts.length - 1) {
        // Innermost level - apply the order
        orderBy = { [part]: orderBy }
      } else {
        // Outer levels - wrap the existing orderBy
        orderBy = { [part]: orderBy }
      }
    }

    return orderBy
  }

  /**
   * Build complete Prisma query options
   */
  static buildPrismaQuery(
    queryDto: QueryDto,
    config: QueryBuilderConfig,
    baseWhere: any = {}
  ): {
    where: any
    skip: number
    take: number
    orderBy: any
  } {
    const {
      searchFields = [],
      filterableFields = [],
      sortableFields = [],
      defaultSortField = 'created_at',
      defaultSortOrder = 'desc',
      nestedFieldMap
    } = config

    // Parse query parameters
    const page = queryDto.page || 1
    const limit = queryDto.limit || 10
    const searchTerm = queryDto.search
    const sortBy = queryDto.sortBy
    const sortOrder = queryDto.sortOrder

    // Use search fields from config only (not from query params)
    const searchFieldsArray = searchFields

    // Parse filters
    let filters = queryDto.filters
    if (typeof filters === 'string' && !this.shouldIgnoreValue(filters)) {
      try {
        filters = JSON.parse(filters)
      } catch {
        filters = {}
      }
    }

    // Build where clause
    const searchWhere = this.buildSearchWhere(
      searchTerm,
      searchFieldsArray,
      nestedFieldMap
    )
    const filterWhere = this.buildFilterWhere(
      filters,
      filterableFields,
      nestedFieldMap
    )

    const where = {
      ...baseWhere,
      ...filterWhere,
      ...(Object.keys(searchWhere).length > 0 ? searchWhere : {})
    }

    // Build order by
    const orderBy = this.buildOrderBy(
      sortBy,
      sortOrder,
      sortableFields,
      defaultSortField,
      defaultSortOrder,
      nestedFieldMap
    )

    // Calculate pagination
    const skip = (page - 1) * limit
    const take = limit

    return {
      where,
      skip,
      take,
      orderBy
    }
  }

  /**
   * Build paginated result
   */
  static buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(total / limit)

    return {
      data,
      metadata: {
        totalDocuments: total,
        currentPage: page,
        totalPages
      }
    }
  }
}
