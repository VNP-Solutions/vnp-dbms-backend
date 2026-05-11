import { ProjectType } from '@prisma/client'

export interface DecryptedPropertyCredential {
  id: string
  property_id: string
  expediaUsername?: string
  expediaPassword?: string
  agodaUsername?: string
  agodaPassword?: string
  bookingUsername?: string
  bookingPassword?: string
  expediaEmailAssociated?: string
  propertyContactEmail?: string
  portfolioContactEmail?: string
  multiplePortfolioEmails?: string[]
  case_contact_email?: string
  case_contact_name?: string
  case_contact_phone?: string
  reporting_contact_name?: string
  reporting_contact_email?: string
  reporting_contact_phone?: string
}

export interface DecryptedPortfolioCredential {
  id: string
  portfolio_id: string
  portfolio_name: string
  credential_type: string
  url?: string
  username?: string
  password: string
  email?: string
  phone_number?: string
  notes?: string
  is_active: boolean
}

export interface ExternalPortfolioDto {
  id: string
  name: string
  service_type_id: string
  service_type: {
    id: string
    type: string
    is_active: boolean
  }
  is_active: boolean
  contact_email?: string
  portfolio_contact_email?: string
  portfolio_contact_name?: string
  portfolio_contact_phone?: string
  is_commissionable: boolean
  commission?: number
  attachment?: string
  contract_signed?: boolean
  created_at: string
  updated_at: string
  total_properties: number
  total_subportfolios: number
  credentials?: DecryptedPortfolioCredential[]
}

export interface ExternalPropertyDto {
  id: string
  name: string
  card_descriptor?: string
  is_active: boolean
  next_due_date?: string
  portfolio_id: string
  portfolio_name: string
  service_type?: string
  subportfolio_id?: string
  subportfolio_name?: string
  previous_portfolio_id?: string
  show_in_portfolio?: string[]
  new_domain_email?: string
  others_case_emails?: string[]
  primary_case_email?: string
  portfolio_contact_email?: string
  portfolio_contact?: string
  webmail_password?: string
  description?: string
  hotel_address?: string
  property_identifier?: string
  case_management_contact?: string
  access_contact?: string
  reporting_contact?: string
  expedia_processor?: string
  booking_processor?: string
  agoda_processor?: string
  from?: string
  to?: string
  qp_username?: string
  qp_password?: string
  qp_api_key?: string
  fp_mid?: string
  fp_username?: string
  fp_password?: string
  stripe_account_email?: string
  expedia_id?: number
  expedia_status?: string
  booking_id?: number
  booking_status?: string
  agoda_id?: number
  agoda_status?: string
  expedia_billing_type?: string
  expedia_service_type?: string
  expedia_frequency?: string
  expedia_access_level?: boolean
  expedia_from?: string
  expedia_to?: string
  expedia_scheduler?: boolean
  expedia_duration?: number
  booking_billing_type?: string
  booking_service_type?: string
  booking_frequency?: string
  booking_access_level?: boolean
  booking_from?: string
  booking_to?: string
  booking_scheduler?: boolean
  booking_duration?: number
  agoda_billing_type?: string
  agoda_service_type?: string
  agoda_frequency?: string
  agoda_access_level?: boolean
  agoda_from?: string
  agoda_to?: string
  agoda_scheduler?: boolean
  agoda_duration?: number
  need_another_domain?: boolean
  booking_otp_phone?: string
  created_at: string
  updated_at: string
  credentials?: DecryptedPropertyCredential
}

export interface ExternalSubportfolioDto {
  id: string
  name: string
  portfolio_id: string
  portfolio_name: string
  description?: string
  is_active: boolean
  total_properties: number
}

export interface ExternalApiQueryDto {
  project_type?: ProjectType
  portfolio_ids?: string[]
  property_ids?: string[]
  subportfolio_ids?: string[]
  is_active?: boolean
  include_credentials?: boolean
}

export class UpdatePropertyCredentialsExternalDto {
  expediaUsername?: string
  expediaPassword?: string
  agodaUsername?: string
  agodaPassword?: string
  bookingUsername?: string
  bookingPassword?: string
  expediaEmailAssociated?: string
  propertyContactEmail?: string
  portfolioContactEmail?: string
  multiplePortfolioEmails?: string[]
  case_contact_email?: string
  case_contact_name?: string
  case_contact_phone?: string
  reporting_contact_name?: string
  reporting_contact_email?: string
  reporting_contact_phone?: string
}
