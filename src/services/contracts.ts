/**
 * Frontend service contracts.
 *
 * These interfaces are the seam between the UI and a future backend /
 * integration layer (for example a BFF that talks to SAP S/4HANA via
 * released APIs). The prototype ships only MOCK implementations
 * (see ./mock). No endpoints are assumed or invented here — a real
 * implementation decides its own transport.
 */
import type {
  ApprovalStep,
  CurrencyCode,
  Customer,
  EmailThread,
  IntegrationEvent,
  Payment,
  Product,
  ProformaInvoice,
  SalesOrderRequest,
  Shipment,
  StockStatus,
} from '@/types/domain'

import type { PublicApplicationView } from '@/workflow/publicView'

export interface SubmissionReceipt {
  id: string
  ref: string
  receivedAt: string
}

export interface PriceAvailability {
  productId: string
  currency: CurrencyCode
  unitPrice: number
  availableQty: number
  stockStatus: StockStatus
  /** Source marker so the UI can label values honestly. */
  source: 'mock'
}

export interface ProductQuery {
  search?: string
  brandIds?: string[]
  categories?: Product['category'][]
}

export interface CustomerService {
  lookupCustomers(query: string): Promise<Customer[]>
  getCustomer(id: string): Promise<Customer | undefined>
}

/**
 * Public application tracking (no sign-in).
 * A backend implementation MUST: look up by reference + verified email (or a
 * hashed, expiring single-purpose token), return only the applicant-safe
 * projection, use the same generic error for "not found" and "mismatch",
 * rate-limit per IP and per reference, and log every attempt.
 */
export type TrackingResult = { ok: true; view: PublicApplicationView } | { ok: false; error: string; locked?: boolean }

export interface ApplicationTrackingService {
  trackByEmail(ref: string, email: string): Promise<TrackingResult>
  trackByToken(ref: string, token: string): Promise<TrackingResult>
}

export interface CatalogService {
  listProducts(query?: ProductQuery): Promise<Product[]>
  getPriceAndAvailability(productIds: string[], customerId: string): Promise<PriceAvailability[]>
}

export interface SalesOrderService {
  submitRequest(request: Pick<SalesOrderRequest, 'customerId' | 'lines' | 'fulfilment'>): Promise<SubmissionReceipt>
  getApprovalStatus(requestId: string): Promise<ApprovalStep[]>
}

export interface FinanceService {
  getProformaInvoice(id: string): Promise<ProformaInvoice | undefined>
  getPaymentStatus(invoiceId: string): Promise<Payment | undefined>
}

export interface LogisticsService {
  getShipmentStatus(id: string): Promise<Shipment | undefined>
}

export interface CommunicationService {
  listConversations(customerId?: string): Promise<EmailThread[]>
}

export interface IntegrationService {
  /** Simulated retry — resolves with the record's new state. */
  retry(event: IntegrationEvent): Promise<IntegrationEvent>
}

export interface TradeFlowServices {
  customers: CustomerService
  catalog: CatalogService
  orders: SalesOrderService
  finance: FinanceService
  logistics: LogisticsService
  communications: CommunicationService
  integration: IntegrationService
}
