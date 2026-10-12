/* Type declarations for ./rules.mjs (dependency-free ordering domain rules). */
export declare function normalizeIndianPhone(raw: unknown): string | null;
export declare function isValidIndianPhone(raw: unknown): boolean;
export declare function maskPhone(phone10: string): string;
export declare function formatPaise(paise: number): string;
export declare function isValidPaise(n: unknown): boolean;
export declare function computeQuote(
  lines: Array<{ item: { pricePaise: number }; quantity: number; selections: Array<{ pricePaise: number }> }>,
  taxRateBps: number,
  chargePaise: number
): { subtotalPaise: number; taxPaise: number; chargePaise: number; totalPaise: number };
export declare const FULFILMENT_STATES: readonly string[];
export declare function isAllowedTransition(from: string, to: string): boolean;
export declare function isTerminalFulfilment(state: string): boolean;
export declare const PAYMENT_STATES: readonly string[];
export declare function derivePaymentStatus(
  totalPaise: number,
  paidPaise: number,
  refundedPaise: number
): string;
export declare function outstandingPaise(
  totalPaise: number,
  paidPaise: number
): number;
export declare function formatOrderNumber(seq: number): string;
export declare function formatTableDisplay(label?: string | null): string;
