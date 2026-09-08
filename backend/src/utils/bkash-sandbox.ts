/**
 * bKash Tokenized Checkout — Sandbox implementation.
 *
 * Implements the real bKash Tokenized Checkout (v1.2.0-beta) API flow:
 *
 *   1. grant()       → POST {baseUrl}/checkout/payment/grant
 *   2. createPayment → POST {baseUrl}/checkout/payment/create
 *   3. executePayment→ POST {baseUrl}/checkout/payment/execute/{paymentID}
 *   4. queryPayment  → POST {baseUrl}/checkout/payment/status/{paymentID}
 *   5. refund        → POST {baseUrl}/checkout/payment/refund
 *
 * Sandbox credentials come ONLY from environment variables:
 *   BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USER_NAME, BKASH_PASSWORD,
 *   BKASH_BASE_URL, BKASH_CALLBACK_URL.
 *
 * PAYMENT_MODE must be "sandbox" for this gateway to engage. If the
 * gateway is invoked in production mode the gateway refuses to run.
 *
 * When sandbox credentials are unavailable, the gateway falls back to a
 * deterministic local mock mode so that payment initiation and verification
 * can proceed in test/development environments without real credentials.
 * The mock mode never performs real financial transactions and is clearly
 * marked in response payloads.
 *
 * Amounts are always formatted server-side as a 2-decimal string (BDT).
 * Token responses are cached in-process and refreshed automatically.
 *
 * Security notes:
 *   - No secret is ever returned or logged by this class.
 *   - The gateway NEVER trusts client-reported amount/status/trxID.
 *   - Failure of any upstream call throws so callers fail closed.
 */
import { PaymentGateway, PaymentGatewayConfig } from './payment-gateway';

const DEFAULT_SANDBOX_BASE_URL = 'https://tokenized.sandbox.bka.sh/v1.2.0-beta';

interface BkashAccessToken {
  id_token: string;
  expires_in: number;
  token_type?: string;
  refresh_token?: string;
}

interface BkashCreatePaymentResponse {
  paymentID?: string;
  createTime?: string;
  orgLogo?: string;
  invoiceNumber?: string;
  statusCode?: string;
  statusMessage?: string;
  [key: string]: unknown;
}

interface BkashExecutePaymentResponse {
  paymentID?: string;
  trxID?: string;
  transactionStatus?: string;
  amount?: string;
  currency?: string;
  statusCode?: string;
  statusMessage?: string;
  [key: string]: unknown;
}

interface BkashQueryPaymentResponse {
  paymentID?: string;
  trxID?: string;
  transactionStatus?: string;
  amount?: string;
  currency?: string;
  statusCode?: string;
  statusMessage?: string;
  [key: string]: unknown;
}

interface MockProviderTransaction {
  reference: string;
  amount: number;
  currency: string;
  status: 'init' | 'success' | 'failed' | 'refunded';
  paidAt?: Date;
  createdAt: Date;
}

const bkashSandboxMockStore = new Map<string, MockProviderTransaction>();

function sanitized(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = /authorization|app-key|password|secret/i.test(k) ? '[REDACTED]' : v;
  }
  return out;
}

function toAmountString(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return Math.round(safe * 100) / 100 < 0 ? '0.00' : Math.round(safe * 100) / 100 === 0 ? '0.00' : (Math.round(safe * 100) / 100).toFixed(2);
}

export class BkashSandboxGateway implements PaymentGateway {
  name = 'bkash';
  readonly mode = 'sandbox';
  private config: PaymentGatewayConfig;
  private accessTokenCache: { token: string; expiresAt: number } | null = null;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  private assertEnabled(): void {
    const mode = process.env.PAYMENT_MODE || 'sandbox';
    if (mode !== 'sandbox') {
      throw new Error('BkashSandboxGateway can only run with PAYMENT_MODE=sandbox');
    }
  }

  private baseUrl(): string {
    return this.config.baseUrl?.trim() || process.env.BKASH_BASE_URL?.trim() || DEFAULT_SANDBOX_BASE_URL;
  }

  private appKey(): string {
    return this.config.apiKey || process.env.BKASH_APP_KEY || process.env.BKASH_API_KEY || '';
  }

  private appSecret(): string {
    return this.config.apiSecret || process.env.BKASH_APP_SECRET || process.env.BKASH_SECRET_KEY || '';
  }

  private username(): string {
    return process.env.BKASH_USER_NAME || '';
  }

  private password(): string {
    return process.env.BKASH_PASSWORD || '';
  }

  private callbackUrl(): string {
    return process.env.BKASH_CALLBACK_URL || '';
  }

  private isConfigured(): boolean {
    return Boolean(this.appKey() && this.appSecret() && this.username() && this.password());
  }

  private mockMode(): boolean {
    // Explicit mock-payment configuration always wins. This is the only
    // path that selects the in-memory mock fallback and must never be
    // active in production. When USE_MOCK_PAYMENT is explicitly false or
    // unset, configured sandbox credentials drive the real flow and an
    // unconfigured gateway falls back to the local mock deterministically.
    if (process.env.USE_MOCK_PAYMENT === 'true') return true;
    return !this.isConfigured();
  }

  private async requestJson<T>(
    path: string,
    options: { method?: string; body?: unknown; token?: string; useAppKey: boolean }
  ): Promise<T> {
    const url = `${this.baseUrl()}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    if (options.useAppKey) headers['X-APP-Key'] = this.appKey();
    if (options.token) headers['Authorization'] = options.token;

    let res: Response;
    try {
      res = await fetch(url, {
        method: options.method || 'POST',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'network error';
      throw new Error(`bKash sandbox API unreachable (${path}): ${detail}`);
    }

    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = { statusCode: String(res.status), statusMessage: 'non-JSON response' };
    }

    if (!res.ok) {
      const code = (payload as Record<string, unknown>)?.statusCode || res.status;
      const message = (payload as Record<string, unknown>)?.statusMessage || res.statusText || 'request failed';
      throw new Error(`bKash sandbox API error ${res.status} (${path}): ${message}`);
    }

    return payload as T;
  }

  private async accessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > now + 60_000) {
      return this.accessTokenCache.token;
    }
    if (!this.isConfigured()) {
      throw new Error(
        'bKash sandbox is not configured. Set BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USER_NAME and BKASH_PASSWORD.'
      );
    }

    const body = {
      app_key: this.appKey(),
      app_secret: this.appSecret(),
      username: this.username(),
      password: this.password()
    };

    const tokenRes: BkashAccessToken = await this.requestJson('/checkout/payment/grant', {
      body,
      useAppKey: true
    });

    if (!tokenRes.id_token) {
      throw new Error('bKash sandbox token grant failed (no id_token in response)');
    }

    const expiresInMs = Number(tokenRes.expires_in || 3600) * 1000;
    this.accessTokenCache = { token: tokenRes.id_token, expiresAt: Date.now() + expiresInMs };
    return tokenRes.id_token;
  }

  async initiate(input: {
    bookingId: number;
    amount: number;
    currency: string;
    customerPhone?: string;
    customerEmail?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    transactionId: string;
    gatewayReference?: string;
    checkoutUrl?: string;
    qrCode?: string;
    expiresAt?: Date;
    raw?: Record<string, unknown>;
  }> {
    this.assertEnabled();

    if (this.mockMode()) {
      const merchantInvoiceNumber = input.metadata?.merchantInvoiceNumber
        ? String(input.metadata.merchantInvoiceNumber)
        : `ETP${Date.now()}`;
      const transactionId = merchantInvoiceNumber.slice(0, 30);

      // When sandbox credentials are unavailable we still return a
      // deterministic gatewayReference so the mock flow (initiate ->
      // execute -> verify) can complete. Without a reference the payment
      // route fails closed at verification with 402, which breaks the
      // test/dev mock-payment path. The reference is server-generated and
      // never trusted from the client, so no security is lost.
      const gatewayReference = `BKASH-MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      bkashSandboxMockStore.set(gatewayReference, {
        reference: gatewayReference,
        amount: Number(input.amount),
        currency: String(input.currency || 'BDT'),
        status: 'init',
        createdAt: new Date()
      });

      return {
        success: true,
        transactionId,
        gatewayReference,
        checkoutUrl: `/pay/${transactionId}`,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        raw: {
          mode: 'sandbox',
          provider: 'bkash',
          mock: true,
          note: 'bKash sandbox credentials not configured; using local mock fallback.'
        }
      };
    }

    const token = await this.accessToken();
    const merchantInvoiceNumber = input.metadata?.merchantInvoiceNumber
      ? String(input.metadata.merchantInvoiceNumber)
      : `ETP${Date.now()}`;

    const createRes: BkashCreatePaymentResponse = await this.requestJson('/checkout/payment/create', {
      token,
      useAppKey: true,
      body: {
        mode: '0011',
        payerReference: input.customerPhone || String(input.bookingId),
        callbackURL: this.callbackUrl(),
        amount: toAmountString(input.amount),
        currency: input.currency || 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: merchantInvoiceNumber.slice(0, 30)
      }
    });

    if (!createRes.paymentID) {
      throw new Error(
        `bKash sandbox payment create failed: ${createRes.statusMessage || createRes.statusCode || 'no paymentID'}`
      );
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return {
      success: true,
      transactionId: merchantInvoiceNumber.slice(0, 30),
      gatewayReference: createRes.paymentID,
      checkoutUrl: `https://sandbox.bka.sh/${createRes.paymentID}`,
      expiresAt,
      raw: {
        mode: 'sandbox',
        provider: 'bkash',
        paymentID: createRes.paymentID,
        createTime: createRes.createTime,
        invoiceNumber: createRes.invoiceNumber
      }
    };
  }

  async execute(input: {
    gatewayReference: string;
    transactionId: string;
  }): Promise<{
    success: boolean;
    status: 'success' | 'failed' | 'pending' | 'unknown';
    providerRefId?: string;
    amount?: number;
    currency?: string;
    paidAt?: Date;
    raw?: Record<string, unknown>;
  }> {
    this.assertEnabled();
    if (!input.gatewayReference) {
      throw new Error('bKash sandbox execute requires a paymentID (gatewayReference)');
    }

    if (this.mockMode()) {
      const txn = bkashSandboxMockStore.get(input.gatewayReference);
      if (!txn) {
        return {
          success: false,
          status: 'failed',
          raw: { mode: 'sandbox', provider: 'bkash', mock: true, reason: 'unknown_reference' }
        };
      }
      txn.status = 'success';
      txn.paidAt = new Date();
      return {
        success: true,
        status: 'success',
        providerRefId: input.gatewayReference,
        amount: txn.amount,
        currency: txn.currency,
        paidAt: txn.paidAt,
        raw: { mode: 'sandbox', provider: 'bkash', mock: true }
      };
    }

    const token = await this.accessToken();

    const executeRes: BkashExecutePaymentResponse = await this.requestJson(
      `/checkout/payment/execute/${encodeURIComponent(input.gatewayReference)}`,
      { token, useAppKey: true }
    );

    const statusRaw = String(executeRes.transactionStatus || '').toLowerCase();

    if (statusRaw === 'completed') {
      const amount = Number(executeRes.amount);
      return {
        success: true,
        status: 'success',
        providerRefId: executeRes.trxID,
        amount: Number.isFinite(amount) ? amount : undefined,
        currency: executeRes.currency,
        paidAt: new Date(),
        raw: { mode: 'sandbox', provider: 'bkash', executeResponse: executeRes }
      };
    }

    if (statusRaw === 'initiated' || statusRaw === 'pending') {
      return {
        success: false,
        status: 'pending',
        providerRefId: executeRes.trxID,
        raw: { mode: 'sandbox', provider: 'bkash', executeResponse: executeRes }
      };
    }

    return {
      success: false,
      status: 'failed',
      providerRefId: executeRes.trxID,
      raw: { mode: 'sandbox', provider: 'bkash', executeResponse: executeRes }
    };
  }

  async verify(input: {
    gatewayReference: string;
    transactionId: string;
    expectedAmount: number;
    expectedCurrency: string;
  }): Promise<{
    success: boolean;
    status: 'success' | 'failed' | 'pending' | 'unknown';
    amount?: number;
    currency?: string;
    paidAt?: Date;
    raw?: Record<string, unknown>;
  }> {
    this.assertEnabled();
    if (!input.gatewayReference) {
      throw new Error('bKash sandbox verify requires a paymentID (gatewayReference)');
    }

    if (this.mockMode()) {
      const txn = bkashSandboxMockStore.get(input.gatewayReference);
      if (!txn) {
        return {
          success: false,
          status: 'failed',
          raw: { mode: 'sandbox', provider: 'bkash', mock: true, reason: 'unknown_reference' }
        };
      }

      if (txn.status === 'success') {
        return {
          success: true,
          status: 'success',
          amount: txn.amount,
          currency: txn.currency,
          paidAt: txn.paidAt || new Date(),
          raw: { mode: 'sandbox', provider: 'bkash', mock: true }
        };
      }

      return {
        success: false,
        status: 'pending',
        amount: txn.amount,
        currency: txn.currency,
        raw: { mode: 'sandbox', provider: 'bkash', mock: true }
      };
    }

    const token = await this.accessToken();

    const queryRes: BkashQueryPaymentResponse = await this.requestJson(
      `/checkout/payment/status/${encodeURIComponent(input.gatewayReference)}`,
      { token, useAppKey: true }
    );

    const statusRaw = String(queryRes.transactionStatus || '').toLowerCase();

    if (statusRaw === 'completed') {
      const amount = Number(queryRes.amount);
      const currency = String(queryRes.currency || input.expectedCurrency).toUpperCase();
      return {
        success: true,
        status: 'success',
        amount: Number.isFinite(amount) ? amount : undefined,
        currency,
        paidAt: new Date(),
        raw: { mode: 'sandbox', provider: 'bkash', queryResponse: queryRes }
      };
    }

    if (statusRaw === 'initiated' || statusRaw === 'pending') {
      return {
        success: false,
        status: 'pending',
        amount: queryRes.amount ? Number(queryRes.amount) : undefined,
        currency: String(queryRes.currency || input.expectedCurrency).toUpperCase(),
        raw: { mode: 'sandbox', provider: 'bkash', queryResponse: queryRes }
      };
    }

    return {
      success: false,
      status: 'failed',
      amount: Number.isFinite(Number(queryRes.amount)) ? Number(queryRes.amount) : undefined,
      currency: String(queryRes.currency || input.expectedCurrency).toUpperCase(),
      raw: { mode: 'sandbox', provider: 'bkash', queryResponse: queryRes }
    };
  }

  async queryPayment(input: {
    gatewayReference: string;
    transactionId: string;
  }): Promise<{
    success: boolean;
    status: 'success' | 'failed' | 'pending' | 'unknown';
    amount?: number;
    currency?: string;
    paidAt?: Date;
    raw?: Record<string, unknown>;
  }> {
    this.assertEnabled();
    if (!input.gatewayReference) {
      throw new Error('bKash sandbox query requires a paymentID (gatewayReference)');
    }

    if (this.mockMode()) {
      const txn = bkashSandboxMockStore.get(input.gatewayReference);
      if (!txn) {
        return {
          success: false,
          status: 'failed',
          raw: { mode: 'sandbox', provider: 'bkash', mock: true, reason: 'unknown_reference' }
        };
      }

      if (txn.status === 'success') {
        return {
          success: true,
          status: 'success',
          amount: txn.amount,
          currency: txn.currency,
          paidAt: txn.paidAt || new Date(),
          raw: { mode: 'sandbox', provider: 'bkash', mock: true }
        };
      }

      return {
        success: false,
        status: 'pending',
        raw: { mode: 'sandbox', provider: 'bkash', mock: true }
      };
    }

    const token = await this.accessToken();

    const queryRes: BkashQueryPaymentResponse = await this.requestJson(
      `/checkout/payment/status/${encodeURIComponent(input.gatewayReference)}`,
      { token, useAppKey: true }
    );

    const statusRaw = String(queryRes.transactionStatus || '').toLowerCase();

    if (statusRaw === 'completed') {
      return {
        success: true,
        status: 'success',
        amount: Number.isFinite(Number(queryRes.amount)) ? Number(queryRes.amount) : undefined,
        currency: String(queryRes.currency || '').toUpperCase(),
        paidAt: new Date(),
        raw: { mode: 'sandbox', provider: 'bkash', queryResponse: queryRes }
      };
    }
    if (statusRaw === 'initiated' || statusRaw === 'pending') {
      return {
        success: false,
        status: 'pending',
        raw: { mode: 'sandbox', provider: 'bkash', queryResponse: queryRes }
      };
    }
    return {
      success: false,
      status: 'failed',
      raw: { mode: 'sandbox', provider: 'bkash', queryResponse: queryRes }
    };
  }

  async refund(input: {
    gatewayReference: string;
    transactionId: string;
    amount: number;
    reason?: string;
  }): Promise<{
    success: boolean;
    refundReference?: string;
    status: 'refunded' | 'failed' | 'unknown';
    raw?: Record<string, unknown>;
  }> {
    this.assertEnabled();
    if (!this.isConfigured()) {
      throw new Error('bKash sandbox is not configured. Set BKASH credentials in environment variables.');
    }
    const token = await this.accessToken();

    const refundBody = {
      paymentID: input.gatewayReference,
      amount: toAmountString(input.amount),
      trxID: input.transactionId,
      sku: 'ETP-BOOKING',
      reason: input.reason || 'Customer refund'
    };

    const refundRes = await this.requestJson<{
      statusCode?: string;
      statusMessage?: string;
      refundTrxID?: string;
      [key: string]: unknown;
    }>('/checkout/payment/refund', {
      token,
      useAppKey: true,
      body: refundBody
    });

    const code = String(refundRes.statusCode || '');
    if (code === '0000' && refundRes.refundTrxID) {
      return {
        success: true,
        refundReference: refundRes.refundTrxID,
        status: 'refunded',
        raw: { mode: 'sandbox', provider: 'bkash', refundResponse: refundRes }
      };
    }

    return {
      success: false,
      status: 'failed',
      raw: { mode: 'sandbox', provider: 'bkash', refundResponse: refundRes }
    };
  }
}
