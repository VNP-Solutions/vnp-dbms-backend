import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class SearchConfig {
  @ApiPropertyOptional({
    description: 'Search term to query',
    example: 'Luxury'
  })
  @IsOptional()
  @IsString()
  term?: string

  @ApiPropertyOptional({
    description: 'Fields to search in (comma-separated or array)',
    example: 'name,contact_email',
    type: [String]
  })
  @IsOptional()
  fields?: string[] | string
}

export class FilterConfig {
  @ApiPropertyOptional({
    description: 'Field name to filter',
    example: 'is_active'
  })
  @IsOptional()
  @IsString()
  field?: string

  @ApiPropertyOptional({
    description: 'Value to filter by',
    example: 'true'
  })
  @IsOptional()
  value?: any

  @ApiPropertyOptional({
    description:
      'Operator for filtering (equals, contains, in, gte, lte, gt, lt)',
    example: 'equals',
    default: 'equals'
  })
  @IsOptional()
  @IsString()
  operator?: 'equals' | 'contains' | 'in' | 'gte' | 'lte' | 'gt' | 'lt' | 'not'
}

export class SortConfig {
  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'created_at'
  })
  @IsOptional()
  @IsString()
  field?: string

  @ApiPropertyOptional({
    description: 'Sort order (asc or desc)',
    example: 'desc',
    enum: ['asc', 'desc'],
    default: 'desc'
  })
  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc'
}

export class QueryDto {
  @ApiPropertyOptional({
    description: 'Page number (starts from 1)',
    example: 1,
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    default: 10
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number

  @ApiPropertyOptional({
    description: 'Search term',
    example: 'Luxury'
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'created_at'
  })
  @IsOptional()
  @IsString()
  sortBy?: string

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc']
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc'

  @ApiPropertyOptional({
    description: 'Filters as JSON string or query params',
    example: '{"is_active":"true"}',
    type: 'string'
  })
  @IsOptional()
  filters?: any
}

export interface PaginatedResult<T> {
  data: T[]
  metadata: {
    totalDocuments: number
    currentPage: number
    totalPages: number
  }
}
