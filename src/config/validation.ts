 
 
 

import { ClassConstructor, plainToInstance } from 'class-transformer'
import { validateSync, ValidationError } from 'class-validator'
import { ConfigurationSchema } from './configuration.schema'

export function validate(config: Record<string, unknown>): ConfigurationSchema {
  try {
    const validatedConfig = plainToInstance(
      ConfigurationSchema as ClassConstructor<ConfigurationSchema>,
      config,
      {
        enableImplicitConversion: true
      }
    )

    const errors = validateSync(validatedConfig, {
      skipMissingProperties: false
    })

    if (errors.length > 0) {
      const errorMessages = errors.map((error: ValidationError) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(', ')
          : 'Unknown validation error'
        return `${error.property}: ${constraints}`
      })

      throw new Error(
        `Configuration validation failed:\n${errorMessages.join('\n')}`
      )
    }

    return validatedConfig
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Configuration validation failed with unknown error')
  }
}
