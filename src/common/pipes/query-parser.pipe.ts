import { Injectable, PipeTransform } from '@nestjs/common'

@Injectable()
export class QueryParserPipe implements PipeTransform {
  transform(value: any) {
    if (!value || typeof value !== 'object') return {}

    const query = value as Record<string, unknown>

    Object.keys(query).forEach((item) => {
      const value = query[item]

      if (typeof value === 'string') {
        if (value === 'true') {
          query[item] = true
        } else if (value === 'false') {
          query[item] = false
        } else if (value === 'undefined') {
          query[item] = undefined
        } else if (value === 'null') {
          query[item] = null
        }
        // start_date and end_date kept as strings - DTOs use @IsString(), services call new Date()
      }

      if (item === 'search' && !query[item]) {
        delete query[item]
      }

      if (String(query[item]).toLowerCase() === 'all') {
        delete query[item]
      }

      // Only convert to number if it's a valid number and not an ID-like string
      const stringValue = String(query[item])
      const isValidNumber =
        !Number.isNaN(Number(stringValue)) && stringValue.trim() !== ''
      const isNotSpecialField = item !== 'phone_number' && item !== 'search'
      const isNotObjectId = !/^[a-f\d]{24}$/i.test(stringValue) // MongoDB ObjectId pattern
      const isNotLongId = stringValue.length < 20 // Avoid converting long ID strings

      if (isValidNumber && isNotSpecialField && isNotObjectId && isNotLongId) {
        query[item] = Number(stringValue)
      }
    })

    return query
  }
}
