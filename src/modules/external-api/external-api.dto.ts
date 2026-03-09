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
  }
  currency_id: string
  currency: {
    id: string
    code: string
    name: string
    symbol?: string
  }
  is_active: boolean
  contact_email?: string
  portfolio_contact_email?: string
  portfolio_contact_name?: string
  portfolio_contact_phone?: string
  is_commissionable: boolean
  sales_agent?: string
  access_email?: string
  access_phone?: string
  created_at: string
  updated_at: string
  total_properties: number
  total_subportfolios: number
  credentials?: DecryptedPortfolioCredential[]
}

export interface ExternalPropertyDto {
  id: string
  name: string
  address: string
  card_descriptor?: string
  is_active: boolean
  next_due_date?: string
  portfolio_id: string
  portfolio_name: string
  subportfolio_id?: string
  subportfolio_name?: string
  previous_portfolio_id?: string
  show_in_portfolio?: string[]
  currency_id: string
  currency_code: string
  currency_name: string
  currency_symbol?: string
  new_domain_email?: string
  others_case_emails?: string[]
  primary_case_email?: string
  webmail_password?: string
  description?: string
  hotel_address?: string
  qp_username?: string
  qp_password?: string
  qp_api_key?: string
  expedia_id?: number
  expedia_status?: string
  booking_id?: number
  booking_status?: string
  agoda_id?: number
  agoda_status?: string
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
