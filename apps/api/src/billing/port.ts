/**
 * billing/port.ts — the till's boundary (LAUNCH_PLAN.md L5). The rest of the app
 * depends on this port, never on Stripe: routes create checkouts/portals through it
 * and hand webhook payloads to it for verification. Tests use a fake; production
 * uses the fetch-based adapter in stripe.ts (no SDK, same spirit as monitor.ts).
 */

/** The slice of a Stripe webhook event the till acts on. */
export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface BillingPort {
  /** Open a subscription checkout for the Light; returns the hosted page URL. */
  createCheckout(
    customerEmail: string,
    userId: string,
    urls: { successUrl: string; cancelUrl: string },
  ): Promise<{ url: string }>;
  /** Open the customer portal (cancel, receipts) for a known Stripe customer. */
  createPortal(customerId: string, returnUrl: string): Promise<{ url: string }>;
  /** Verify a webhook signature; the parsed event when genuine, null otherwise. */
  verifyWebhook(payload: string, signatureHeader: string, nowMs: number): StripeEvent | null;
}
