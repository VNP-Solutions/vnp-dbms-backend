import type { PropertyWithRelations } from './property.interface'

/**
 * Maps each "given column name" (from RoleColumnTemplate.column_list) to the
 * actual model fields that must be included on the Property response object.
 * For FK relation fields both the _id field and the populated relation object are included.
 */
const COLUMN_TO_FIELDS: Record<string, string[]> = {
  portfolio_id:                ['portfolio_id', 'portfolio'],
  subportfolio_id:             ['subportfolio_id', 'subportfolio'],
  service_type:                ['service_type_id', 'service_type'],
  name:                        ['name'],
  property_identifier:         ['property_identifier'],
  description:                 ['description'],
  is_active:                   ['is_active'],
  next_due_date:               ['next_due_date'],
  ota_access_levels:           ['expedia_access_level', 'booking_access_level', 'agoda_access_level'],
  ota_credentials_verified:    ['expedia_credential_verified', 'booking_credential_verified', 'agoda_credential_verified'],
  expedia_billing_type:        ['expedia_billing_type_id', 'expedia_billing_type'],
  expedia_id:                  ['expedia_id'],
  expedia_status:              ['expedia_status'],
  expedia_service_type:        ['expedia_service_type_id', 'expedia_service_type'],
  expedia_service_fee:         ['expedia_service_fee'],
  priority:                    ['priority_id', 'priority'],
  expedia_priority:            ['expedia_priority'],
  booking_priority:            ['booking_priority'],
  agoda_priority:              ['agoda_priority'],
  expedia_frequency:           ['expedia_frequency_id', 'expedia_frequency'],
  expedia_historical_review:   ['expedia_from', 'expedia_to'],
  expedia_historical_review_db:['from_db', 'to_db'],
  expedia_revised_date:        ['expedia_revised_date'],
  expedia_scheduler:           ['expedia_scheduler'],
  expedia_scheduler_review:    ['expedia_scheduler_review_from', 'expedia_scheduler_review_to'],
  expedia_scheduler_review_db: ['expedia_scheduler_db', 'expedia_scheduler_review_db_from', 'expedia_scheduler_review_db_to'],
  expedia_duration:            ['expedia_duration'],
  expedia_db_duration:         ['expedia_db_duration'],
  expedia_crs:                 ['expedia_crs'],
  expedia_crs_db:              ['expedia_crs_db'],
  expedia_run_date:            ['expedia_run_date'],
  expedia_run_date_db:         ['expedia_run_date_db'],
  expedia_processor:           ['expedia_processor_id', 'expedia_processor'],
  expedia_otp_number:          ['expedia_otp_number'],
  expedia_screenshots:         ['expedia_screenshot_urls'],
  need_another_domain:         ['need_another_domain'],
  booking_id:                  ['booking_id'],
  booking_status:              ['booking_status'],
  booking_billing_type:        ['booking_billing_type_id', 'booking_billing_type'],
  booking_service_type:        ['booking_service_type_id', 'booking_service_type'],
  booking_service_fee:         ['booking_service_fee'],
  booking_frequency:           ['booking_frequency_id', 'booking_frequency'],
  booking_historical_review:   ['booking_from', 'booking_to'],
  booking_scheduler:           ['booking_scheduler'],
  booking_duration:            ['booking_duration'],
  booking_run_date:            ['booking_run_date'],
  booking_revised_date:        ['booking_revised_date'],
  booking_processor:           ['booking_processor_id', 'booking_processor'],
  booking_otp_phone:           ['booking_otp_phone'],
  booking_otp_number:          ['booking_otp_number'],
  booking_screenshots:         ['booking_screenshot_urls'],
  agoda_id:                    ['agoda_id'],
  agoda_status:                ['agoda_status'],
  agoda_billing_type:          ['agoda_billing_type_id', 'agoda_billing_type'],
  agoda_service_type:          ['agoda_service_type_id', 'agoda_service_type'],
  agoda_service_fee:           ['agoda_service_fee'],
  agoda_frequency:             ['agoda_frequency_id', 'agoda_frequency'],
  agoda_historical_review:     ['agoda_from', 'agoda_to'],
  agoda_scheduler:             ['agoda_scheduler'],
  agoda_duration:              ['agoda_duration'],
  agoda_run_date:              ['agoda_run_date'],
  agoda_revised_date:          ['agoda_revised_date'],
  agoda_processor:             ['agoda_processor_id', 'agoda_processor'],
  agoda_screenshots:           ['agoda_screenshot_urls'],
  hotel_address:               ['hotel_address'],
  portfolio_contact:           ['portfolio_contact'],
  portfolio_contact_email:     ['portfolio_contact_email'],
  reporting_contact:           ['reporting_contact'],
  primary_case_email:          ['primary_case_email'],
  case_management_contact:     ['case_management_contact'],
  access_contact:              ['access_contact'],
  card_descriptor:             ['card_descriptor'],
  qp_username:                 ['qp_username'],
  qp_password:                 ['qp_password'],
  qp_api_key:                  ['qp_api_key'],
  fp_username:                 ['fp_username'],
  fp_password:                 ['fp_password'],
  fp_mid:                      ['fp_mid'],
  webmail_password:            ['webmail_password'],
  new_domain_email:            ['new_domain_email'],
  sales_rep:                   ['sales_rep'],
  currency:                    ['currency_id', 'currency'],
  discontinued_email_ids:      ['discontinued_email_ids'],
  cybersource_mid:             ['cybersource_mid'],
  adyen_location:              ['adyen_location'],
  stripe_connected_email:      ['stripe_connected_email'],
  stripe_account_email:        ['stripe_account_email'],
  notes:                       ['notes', 'total_notes'],
}

/**
 * Maps credential-related column names to the corresponding field name
 * inside each PropertyCredentials record.
 */
const CREDENTIAL_COLUMN_TO_FIELD: Record<string, string> = {
  userNameExpedia:            'expediaUsername',
  passwordExpedia:            'expediaPassword',
  expedia_secondary_username: 'expediaSecondaryUsername',
  expedia_secondary_password: 'expediaSecondaryPassword',
  userNameBooking:            'bookingUsername',
  passwordBooking:            'bookingPassword',
  booking_secondary_username: 'bookingSecondaryUsername',
  booking_secondary_password: 'bookingSecondaryPassword',
  userNameAgoda:              'agodaUsername',
  passwordAgoda:              'agodaPassword',
  agoda_secondary_username:   'agodaSecondaryUsername',
  agoda_secondary_password:   'agodaSecondaryPassword',
}

/** Fields always present in every filtered response */
const ALWAYS_INCLUDE = ['id', 'created_at', 'updated_at']

/**
 * Returns a new object containing only the property fields that correspond
 * to the given column list from a RoleColumnTemplate.
 *
 * - Always includes id, created_at, updated_at.
 * - For FK columns (e.g. "currency") both the _id scalar and the populated
 *   relation object are included.
 * - Credential columns are filtered to only the requested sub-fields.
 */
export function applyColumnFilter(
  property: PropertyWithRelations,
  columnList: string[]
): Record<string, any> {
  const prop = property as any
  const result: Record<string, any> = {}

  for (const f of ALWAYS_INCLUDE) {
    if (f in prop) result[f] = prop[f]
  }

  const propertyFields = new Set<string>()
  const credentialFields = new Set<string>()

  for (const col of columnList) {
    if (CREDENTIAL_COLUMN_TO_FIELD[col]) {
      credentialFields.add(CREDENTIAL_COLUMN_TO_FIELD[col])
    } else if (COLUMN_TO_FIELDS[col]) {
      for (const f of COLUMN_TO_FIELDS[col]) propertyFields.add(f)
    }
  }

  for (const field of propertyFields) {
    if (field in prop) result[field] = prop[field]
  }

  if (credentialFields.size > 0 && Array.isArray(prop.credentials)) {
    result.credentials = (prop.credentials as any[]).map((cred: any) => {
      const filtered: Record<string, any> = {
        id: cred.id,
        property_id: cred.property_id
      }
      for (const f of credentialFields) {
        if (f in cred) filtered[f] = cred[f]
      }
      return filtered
    })
  }

  return result
}
