import { PaymentGateway, PaymentGatewayConfig, PaymentGatewayInitiateInput, PaymentGatewayInitiateResult, PaymentGatewayVerificationInput, PaymentGatewayVerificationResult, PaymentGatewayRefundInput, PaymentGatewayRefundResult, PaymentGatewayQueryInput, PaymentGatewayExecuteInput, PaymentGatewayExecuteResult } from './payment-gateway';
export { PaymentGateway, PaymentGatewayConfig, PaymentGatewayInitiateInput, PaymentGatewayInitiateResult, PaymentGatewayVerificationInput, PaymentGatewayVerificationResult, PaymentGatewayRefundInput, PaymentGatewayRefundResult, PaymentGatewayQueryInput, PaymentGatewayExecuteInput, PaymentGatewayExecuteResult } from './payment-gateway';
import { BkashSandboxGateway } from './bkash-sandbox';
export { BkashSandboxGateway };

interface MockProviderTransaction {
  reference: string;
  amount: number;
  currency: string;
  status: 'init' | 'success' | 'failed' | 'refunded';
  paidAt?: Date;
  createdAt: Date;
}

const mockProviderStore = new Map<string, MockProviderTransaction>();

export function resetMockGatewayStore(): void {
  mockProviderStore.clear();
}

export class MockPaymentGateway implements PaymentGateway {
  name = 'mock';
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  async initiate(input: PaymentGatewayInitiateInput): Promise<PaymentGatewayInitiateResult> {
    const transactionId = `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    mockProviderStore.set(transactionId, {
      reference: transactionId,
      amount: Number(input.amount),
      currency: String(input.currency || 'BDT'),
      status: 'init',
      createdAt: new Date()
    });
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
    const txn = mockProviderStore.get(input.gatewayReference);
    if (!txn) {
      return {
        success: false,
        status: 'failed',
        raw: { mode: 'mock', provider: this.config.provider, reason: 'unknown_reference' }
      };
    }
    if (txn.status === 'success') {
      return {
        success: true,
        status: 'success',
        amount: txn.amount,
        currency: txn.currency,
        paidAt: txn.paidAt || new Date(),
        raw: { mode: 'mock', provider: this.config.provider }
      };
    }
    if (txn.status === 'init') {
      return {
        success: false,
        status: 'pending',
        amount: txn.amount,
        currency: txn.currency,
        raw: { mode: 'mock', provider: this.config.provider }
      };
    }
    return {
      success: false,
      status: 'failed',
      amount: txn.amount,
      currency: txn.currency,
      raw: { mode: 'mock', provider: this.config.provider }
    };
  }

  async execute(input: PaymentGatewayExecuteInput): Promise<PaymentGatewayExecuteResult> {
    const txn = mockProviderStore.get(input.gatewayReference);
    if (!txn) {
      return {
        success: false,
        status: 'failed',
        raw: { mode: 'mock', provider: this.config.provider, reason: 'unknown_reference' }
      };
    }
    if (txn.status !== 'success') {
      if (txn.status === 'init') {
        txn.status = 'success';
        txn.paidAt = new Date();
        return {
          success: true,
          status: 'success',
          providerRefId: txn.reference,
          amount: txn.amount,
          currency: txn.currency,
          paidAt: txn.paidAt,
          raw: { mode: 'mock', provider: this.config.provider }
        };
      }
      return {
        success: false,
        status: 'failed',
        providerRefId: txn.reference,
        raw: { mode: 'mock', provider: this.config.provider }
      };
    }
    return {
      success: true,
      status: 'success',
      providerRefId: txn.reference,
      amount: txn.amount,
      currency: txn.currency,
      paidAt: txn.paidAt,
      raw: { mode: 'mock', provider: this.config.provider }
    };
  }

  async queryPayment(input: PaymentGatewayQueryInput): Promise<PaymentGatewayVerificationResult> {
    const txn = mockProviderStore.get(input.gatewayReference);
    if (!txn) {
      return {
        success: false,
        status: 'failed',
        raw: { mode: 'mock', provider: this.config.provider, reason: 'unknown_reference' }
      };
    }
    if (txn.status === 'success') {
      return {
        success: true,
        status: 'success',
        amount: txn.amount,
        currency: txn.currency,
        paidAt: txn.paidAt,
        raw: { mode: 'mock', provider: this.config.provider }
      };
    }
    if (txn.status === 'init') {
      return {
        success: false,
        status: 'pending',
        raw: { mode: 'mock', provider: this.config.provider }
      };
    }
    return {
      success: false,
      status: 'failed',
      raw: { mode: 'mock', provider: this.config.provider }
    };
  }

  async refund(input: PaymentGatewayRefundInput): Promise<PaymentGatewayRefundResult> {
    const txn = mockProviderStore.get(input.gatewayReference);
    if (!txn || txn.status !== 'success') {
      return {
        success: false,
        status: 'failed',
        raw: { mode: 'mock', provider: this.config.provider, reason: 'no_successful_transaction' }
      };
    }
    if (Number(input.amount) !== txn.amount) {
      return {
        success: false,
        status: 'failed',
        raw: { mode: 'mock', provider: this.config.provider, reason: 'amount_mismatch' }
      };
    }
    txn.status = 'refunded';
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

    throw new Error('bKashPaymentGateway.verify() is not implemented for production use');
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

    throw new Error('NagadPaymentGateway.verify() is not implemented for production use');
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

    throw new Error('SSLCommerzPaymentGateway.verify() is not implemented for production use');
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

  if (normalized === 'bkash' && process.env.USE_MOCK_PAYMENT === 'true') {
    return new MockPaymentGateway(config);
  }

  switch (normalized) {
    case 'bkash':
      return new BkashPaymentGateway(config);
    case 'nagad':
      return new NagadPaymentGateway(config);
    case 'sslcommerz':
      return new SSLCommerzPaymentGateway(config);
    case 'mock':
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Mock payment gateway is not allowed in production');
      }
      return new MockPaymentGateway(config);
    default:
      throw new Error(`Unsupported payment provider: ${provider}`);
  }
}

