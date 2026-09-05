import { PaymentGateway, PaymentGatewayConfig, PaymentGatewayInitiateInput, PaymentGatewayInitiateResult, PaymentGatewayVerificationInput, PaymentGatewayVerificationResult, PaymentGatewayRefundInput, PaymentGatewayRefundResult, PaymentGatewayQueryInput, PaymentGatewayExecuteInput, PaymentGatewayExecuteResult } from './payment-gateway';
import { BkashSandboxGateway } from './bkash-sandbox';

export class MockPaymentGateway implements PaymentGateway {
  name = 'mock';
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  async initiate(input: PaymentGatewayInitiateInput): Promise<PaymentGatewayInitiateResult> {
    const transactionId = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return {
      success: true,
      transactionId,
      gatewayReference: transactionId,
      checkoutUrl: `/pay/${transactionId}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      raw: { mode: 'mock', provider: this.config.provider }
    };
  }

  async verify(input: PaymentGatewayVerificationInput): Promise<PaymentGatewayVerificationResult> {
    return {
      success: true,
      status: 'success',
      amount: input.expectedAmount,
      currency: input.expectedCurrency,
      paidAt: new Date(),
      raw: { mode: 'mock', provider: this.config.provider }
    };
  }

  async execute(input: PaymentGatewayExecuteInput): Promise<PaymentGatewayExecuteResult> {
    throw new Error('Mock gateway does not support execution. Use PAYMENT_MODE=sandbox for the real flow.');
  }

  async queryPayment(input: PaymentGatewayQueryInput): Promise<PaymentGatewayVerificationResult> {
    return {
      success: true,
      status: 'success',
      raw: { mode: 'mock', provider: this.config.provider }
    };
  }

  async refund(input: PaymentGatewayRefundInput): Promise<PaymentGatewayRefundResult> {
    return {
      success: true,
      refundReference: `MOCK-REF-${Date.now()}`,
      status: 'refunded',
      raw: { mode: 'mock', provider: this.config.provider }
    };
  }
}

export class BkashPaymentGateway implements PaymentGateway {
  name = 'bkash';
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  async initiate(input: PaymentGatewayInitiateInput): Promise<PaymentGatewayInitiateResult> {
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.baseUrl) {
      throw new Error('bKash stub gateway requires BKASH_APP_KEY, BKASH_APP_SECRET, and BKASH_BASE_URL. For the real sandbox use BkashSandboxGateway.');
    }

    const transactionId = `BKASH-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return {
      success: true,
      transactionId,
      gatewayReference: transactionId,
      checkoutUrl: `${this.config.baseUrl}/checkout/${transactionId}`,
      expiresAt,
      raw: { mode: 'stub', provider: 'bkash', note: 'STUB: No real bKash API call is made. Use PAYMENT_MODE=sandbox for the real sandbox flow.' }
    };
  }

  async verify(input: PaymentGatewayVerificationInput): Promise<PaymentGatewayVerificationResult> {
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.baseUrl) {
      throw new Error('bKash stub gateway is not configured.');
    }

    return {
      success: true,
      status: 'success',
      amount: input.expectedAmount,
      currency: input.expectedCurrency,
      paidAt: new Date(),
      raw: { mode: 'stub', provider: 'bkash', note: 'STUB: No real bKash API call is made. Use PAYMENT_MODE=sandbox for the real sandbox flow.' }
    };
  }

  async execute(input: PaymentGatewayExecuteInput): Promise<PaymentGatewayExecuteResult> {
    throw new Error('bKash stub gateway does not support execution. Use PAYMENT_MODE=sandbox for the real sandbox flow.');
  }

  async queryPayment(input: PaymentGatewayQueryInput): Promise<PaymentGatewayVerificationResult> {
    return {
      success: false,
      status: 'unknown',
      raw: { mode: 'stub', provider: 'bkash', note: 'STUB gateway does not support querying. Use BkashSandboxGateway.' }
    };
  }

  async refund(input: PaymentGatewayRefundInput): Promise<PaymentGatewayRefundResult> {
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.baseUrl) {
      throw new Error('bKash stub gateway is not configured.');
    }

    return {
      success: true,
      refundReference: `BKASH-REF-${Date.now()}`,
      status: 'refunded',
      raw: { mode: 'stub', provider: 'bkash', note: 'STUB: No real bKash API call is made. Use PAYMENT_MODE=sandbox for the real sandbox flow.' }
    };
  }
}

export class NagadPaymentGateway implements PaymentGateway {
  name = 'nagad';
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  async initiate(input: PaymentGatewayInitiateInput): Promise<PaymentGatewayInitiateResult> {
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.baseUrl) {
      throw new Error('Nagad gateway is not configured. Set NAGAD_API_KEY, NAGAD_SECRET_KEY, and NAGAD_BASE_URL.');
    }

    const transactionId = `NAGAD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return {
      success: true,
      transactionId,
      gatewayReference: transactionId,
      checkoutUrl: `${this.config.baseUrl}/checkout/${transactionId}`,
      expiresAt,
      raw: { mode: 'stub', provider: 'nagad', note: 'STUB: No real Nagad API call is made. Production integration required.' }
    };
  }

  async verify(input: PaymentGatewayVerificationInput): Promise<PaymentGatewayVerificationResult> {
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.baseUrl) {
      throw new Error('Nagad gateway is not configured.');
    }

    return {
      success: true,
      status: 'success',
      amount: input.expectedAmount,
      currency: input.expectedCurrency,
      paidAt: new Date(),
      raw: { mode: 'stub', provider: 'nagad', note: 'STUB: No real Nagad API call is made. Production integration required.' }
    };
  }

  async execute(input: PaymentGatewayExecuteInput): Promise<PaymentGatewayExecuteResult> {
    throw new Error('Nagad stub gateway does not support execution. Production integration required.');
  }

  async queryPayment(input: PaymentGatewayQueryInput): Promise<PaymentGatewayVerificationResult> {
    return {
      success: false,
      status: 'unknown',
      raw: { mode: 'stub', provider: 'nagad', note: 'STUB gateway does not support querying.' }
    };
  }

  async refund(input: PaymentGatewayRefundInput): Promise<PaymentGatewayRefundResult> {
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.baseUrl) {
      throw new Error('Nagad gateway is not configured.');
    }

    return {
      success: true,
      refundReference: `NAGAD-REF-${Date.now()}`,
      status: 'refunded',
      raw: { mode: 'stub', provider: 'nagad', note: 'STUB: No real Nagad API call is made. Production integration required.' }
    };
  }
}

export class SSLCommerzPaymentGateway implements PaymentGateway {
  name = 'sslcommerz';
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  async initiate(input: PaymentGatewayInitiateInput): Promise<PaymentGatewayInitiateResult> {
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.baseUrl) {
      throw new Error('SSLCommerz gateway is not configured. Set SSLCOMMERZ_STORE_ID, SSLCOMMERZ_STORE_PASSWORD, and SSLCOMMERZ_BASE_URL.');
    }

    const transactionId = `SSL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    return {
      success: true,
      transactionId,
      gatewayReference: transactionId,
      checkoutUrl: `${this.config.baseUrl}/checkout/${transactionId}`,
      expiresAt,
      raw: { mode: 'stub', provider: 'sslcommerz', note: 'STUB: No real SSLCommerz API call is made. Production integration required.' }
    };
  }

  async verify(input: PaymentGatewayVerificationInput): Promise<PaymentGatewayVerificationResult> {
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.baseUrl) {
      throw new Error('SSLCommerz gateway is not configured.');
    }

    return {
      success: true,
      status: 'success',
      amount: input.expectedAmount,
      currency: input.expectedCurrency,
      paidAt: new Date(),
      raw: { mode: 'stub', provider: 'sslcommerz', note: 'STUB: No real SSLCommerz API call is made. Production integration required.' }
    };
  }

  async execute(input: PaymentGatewayExecuteInput): Promise<PaymentGatewayExecuteResult> {
    throw new Error('SSLCommerz stub gateway does not support execution. Production integration required.');
  }

  async queryPayment(input: PaymentGatewayQueryInput): Promise<PaymentGatewayVerificationResult> {
    return {
      success: false,
      status: 'unknown',
      raw: { mode: 'stub', provider: 'sslcommerz', note: 'STUB gateway does not support querying.' }
    };
  }

  async refund(input: PaymentGatewayRefundInput): Promise<PaymentGatewayRefundResult> {
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.baseUrl) {
      throw new Error('SSLCommerz gateway is not configured.');
    }

    return {
      success: true,
      refundReference: `SSL-REF-${Date.now()}`,
      status: 'refunded',
      raw: { mode: 'stub', provider: 'sslcommerz', note: 'STUB: No real SSLCommerz API call is made. Production integration required.' }
    };
  }
}

export function resolvePaymentGateway(provider: string, config: PaymentGatewayConfig): PaymentGateway {
  const normalized = provider.toLowerCase();
  const mode = (process.env.PAYMENT_MODE || 'sandbox').toLowerCase();

  if (normalized === 'bkash' && mode === 'sandbox') {
    return new BkashSandboxGateway(config);
  }

  switch (normalized) {
    case 'bkash':
      return new BkashPaymentGateway(config);
    case 'nagad':
      return new NagadPaymentGateway(config);
    case 'sslcommerz':
      return new SSLCommerzPaymentGateway(config);
    case 'mock':
      return new MockPaymentGateway(config);
    default:
      return new MockPaymentGateway(config);
  }
}

export { BkashSandboxGateway, PaymentGatewayConfig };