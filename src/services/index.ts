import type { TradeFlowServices } from './contracts'
import { mockServices } from './mock'

/**
 * Single switch point for data services. Replace with a real implementation
 * (e.g. `createHttpServices(config)`) once a backend exists.
 */
export const services: TradeFlowServices = mockServices

export type * from './contracts'
