const CAKTO_API = 'https://api.cakto.com.br';
const TOKEN_URL = `${CAKTO_API}/public_api/token/`;
const ORDER_URL = (id: string) => `${CAKTO_API}/public_api/order/${id}/`;
const SUBSCRIPTION_URL = (id: string) => `${CAKTO_API}/public_api/subscription/${id}/`;

interface CaktoTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

interface CaktoApiError {
  detail?: string;
  [key: string]: unknown;
}

export class CaktoClient {
  private clientId: string;
  private clientSecret: string;
  private token: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async ensureToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt - 60000) {
      return this.token;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const err: CaktoApiError = await res.json().catch(() => ({}));
      throw new Error(`Cakto token error: ${res.status} ${err.detail || res.statusText}`);
    }

    const data: CaktoTokenResponse = await res.json();
    this.token = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.token!;
  }

  private async request<T>(url: string): Promise<T> {
    const token = await this.ensureToken();
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const err: CaktoApiError = await res.json().catch(() => ({}));
      throw new Error(`Cakto API error: ${res.status} ${err.detail || res.statusText}`);
    }

    return res.json();
  }

  async getOrder(orderId: string): Promise<OrderResponse> {
    return this.request<OrderResponse>(ORDER_URL(orderId));
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionResponse> {
    return this.request<SubscriptionResponse>(SUBSCRIPTION_URL(subscriptionId));
  }
}

export interface OrderResponse {
  id: number;
  transaction: string;
  status: string;
  value: number;
  value_with_tax: number;
  created: string;
  updated: string;
  paid: string | null;
  coupon: string | null;
  discount: number;
  shipping: number;
  shipping_type: string | null;
  tracking_code: string | null;
  items: Array<{
    id: number;
    product: number;
    product_name: string;
    offer: number;
    offer_name: string;
    quantity: number;
    value: number;
  }>;
  customer: {
    id: number;
    name: string;
    email: string;
    phone: string;
    document: string;
  };
  payment: {
    method: string;
    installments: number;
  };
  subscription: number | null;
  url: string;
}

export interface SubscriptionResponse {
  id: number;
  status: string;
  created: string;
  updated: string;
  canceled: string | null;
  cycle: string;
  period: string;
  period_days: number;
  value: number;
  charge_day: number;
  expires_in: string | null;
  next_charge: string | null;
  orders: string[];
  product: {
    id: number;
    name: string;
  };
  offer: {
    id: number;
    name: string;
  };
  customer: {
    id: number;
    name: string;
    email: string;
    phone: string;
    document: string;
  };
  current_period: {
    start: string;
    end: string;
  } | null;
  url: string;
}
