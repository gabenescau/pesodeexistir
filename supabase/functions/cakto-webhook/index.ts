import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';
import { CaktoClient } from '../_shared/cakto-client.ts';

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  secret: string;
}

// Comparar segredos com `!==` vaza informação por tempo: a comparação de
// strings aborta no primeiro byte diferente, então um atacante consegue
// descobrir o segredo caractere a caractere medindo a latência das respostas.
// Comparamos os digests SHA-256 (sempre 32 bytes) em tempo constante, o que
// também evita vazar o comprimento do segredo.
async function secretsMatch(received: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(received)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);

  const viewA = new Uint8Array(a);
  const viewB = new Uint8Array(b);

  let diff = 0;
  for (let i = 0; i < viewA.length; i++) {
    diff |= viewA[i] ^ viewB[i];
  }

  return diff === 0;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const expectedSecret = Deno.env.get('CAKTO_WEBHOOK_SECRET');
  if (!expectedSecret) {
    console.error('CAKTO_WEBHOOK_SECRET not configured');
    return new Response('Server error', { status: 500 });
  }

  let body: WebhookPayload;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!(await secretsMatch(body.secret ?? '', expectedSecret))) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!body.event || !body.data) {
    return new Response('Missing event or data', { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const eventId = `${body.event}_${body.data.order || ''}_${body.data.subscription || ''}_${body.data.status || ''}`;

  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id, status')
    .eq('external_event_id', eventId)
    .maybeSingle();

  if (existingEvent && existingEvent.status === 'processed') {
    return new Response('OK', { status: 200 });
  }

  const { error: insertError } = await supabase
    .from('webhook_events')
    .insert({
      provider: 'cakto',
      external_event_id: eventId,
      event_type: body.event,
      payload: body,
      status: 'received',
    });

  if (insertError) {
    console.error('Failed to insert webhook event:', insertError);
    return new Response('OK', { status: 200 });
  }

  try {
    const data = body.data as Record<string, unknown>;

    let internalStatus = mapStatus(body.event, data.status as string | undefined);

    let customerEmail: string | undefined;
    let customerId: string | number | undefined;
    let orderId: string | number | undefined;
    let subscriptionId: string | number | undefined;
    let productId: string | number | undefined;
    let offerId: string | number | undefined;
    let currentPeriodStart: string | undefined;
    let currentPeriodEnd: string | undefined;
    let canceledAt: string | undefined;

    const eventsRequiringLookup = [
      'subscription_created',
      'subscription_renewed',
      'subscription_canceled',
      'subscription_renewal_refused',
    ];

    if (eventsRequiringLookup.includes(body.event) && data.subscription) {
      const caktoClientId = Deno.env.get('CAKTO_CLIENT_ID');
      const caktoClientSecret = Deno.env.get('CAKTO_CLIENT_SECRET');

      if (caktoClientId && caktoClientSecret) {
        try {
          const cakto = new CaktoClient(caktoClientId, caktoClientSecret);
          const sub = await cakto.getSubscription(String(data.subscription));
          subscriptionId = sub.id;
          customerEmail = sub.customer.email;
          customerId = sub.customer.id;
          productId = sub.product.id;
          offerId = sub.offer.id;
          internalStatus = mapStatus(body.event, sub.status);

          if (sub.current_period) {
            currentPeriodStart = sub.current_period.start;
            currentPeriodEnd = sub.current_period.end;
          }

          canceledAt = sub.canceled || undefined;
        } catch (e) {
          console.error('Failed to lookup subscription:', e);
        }
      }
    }

    if (data.customer && typeof data.customer === 'object') {
      const cust = data.customer as Record<string, unknown>;
      customerEmail = customerEmail || (cust.email as string);
      customerId = customerId || (cust.id as number);
    }

    if (body.event === 'purchase_approved' && data.order) {
      orderId = data.order as number;
      subscriptionId = data.subscription as number | undefined;
    }

    if ((data.current_period as Record<string, unknown>)?.start) {
      currentPeriodStart = (data.current_period as Record<string, unknown>).start as string;
      currentPeriodEnd = (data.current_period as Record<string, unknown>).end as string;
    }

    productId = productId || (data.product as number);
    offerId = offerId || (data.offer as number);

    if (!customerEmail) {
      if (orderId) {
        const caktoClientId = Deno.env.get('CAKTO_CLIENT_ID');
        const caktoClientSecret = Deno.env.get('CAKTO_CLIENT_SECRET');
        if (caktoClientId && caktoClientSecret) {
          try {
            const cakto = new CaktoClient(caktoClientId, caktoClientSecret);
            const order = await cakto.getOrder(String(orderId));
            customerEmail = order.customer.email;
            customerId = customerId || order.customer.id;
            productId = productId || order.items[0]?.product;
            offerId = offerId || order.items[0]?.offer;
            orderId = order.id;
            subscriptionId = subscriptionId || order.subscription;
          } catch (e) {
            console.error('Failed to lookup order:', e);
          }
        }
      }
    }

    if (!customerEmail) {
      throw new Error('Could not determine customer email from webhook payload');
    }

    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id, user_id, status, created_at')
      .eq('customer_email', customerEmail)
      .maybeSingle();

    const wasInactiveBefore = !existingSub || existingSub.status === 'canceled'
      || existingSub.status === 'expired';

    let userId = existingSub?.user_id;

    if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
      const { data: checkoutMatch } = await supabase
        .from('checkout_sessions')
        .select('user_id')
        .eq('user_email', customerEmail)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkoutMatch) {
        userId = checkoutMatch.user_id;
      }
    }

    if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
      userId = '00000000-0000-0000-0000-000000000000';
    }

    const subscriptionRecord = {
      user_id: userId,
      customer_email: customerEmail,
      status: internalStatus,
      provider_product_id: productId != null ? String(productId) : undefined,
      provider_offer_id: offerId != null ? String(offerId) : undefined,
      provider_order_id: orderId != null ? String(orderId) : undefined,
      provider_subscription_id: subscriptionId != null ? String(subscriptionId) : undefined,
      provider_customer_id: customerId != null ? String(customerId) : undefined,
      current_period_start: currentPeriodStart || undefined,
      current_period_end: currentPeriodEnd || undefined,
      canceled_at: canceledAt || undefined,
      updated_at: new Date().toISOString(),
    };

    if (existingSub) {
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update(subscriptionRecord)
        .eq('id', existingSub.id);

      if (updateError) {
        throw updateError;
      }
    } else {
      const { error: insertSubError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          customer_email: customerEmail,
          plan: 'ope_club_monthly',
          status: internalStatus,
          ...subscriptionRecord,
        });

      if (insertSubError) {
        throw insertSubError;
      }
    }

    if (body.event === 'purchase_approved' && orderId != null) {
      await supabase
        .from('checkout_sessions')
        .update({
          status: 'completed',
          provider_order_id: String(orderId),
          updated_at: new Date().toISOString(),
        })
        .eq('provider_order_id', String(orderId))
        .eq('provider', 'cakto');
    }

    if (body.event === 'subscription_canceled') {
      await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: false,
          canceled_at: canceledAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('customer_email', customerEmail);
    }

    await supabase
      .from('webhook_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('external_event_id', eventId);

    if (wasInactiveBefore && internalStatus === 'active') {
      try {
        const res = await supabase.functions.invoke('send-welcome', {
          body: {
            email: customerEmail,
            subscription_id: subscriptionId,
          },
        });
        if (res.error) {
          console.error('Failed to send welcome email:', res.error);
        }
      } catch (e) {
        console.error('Failed to invoke send-welcome function:', e);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);

    await supabase
      .from('webhook_events')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('external_event_id', eventId);

    return new Response('OK', { status: 200 });
  }
});

function mapStatus(event: string, caktoStatus?: string): string {
  if (!caktoStatus) {
    switch (event) {
      case 'purchase_approved':
        return 'active';
      case 'subscription_created':
        return 'active';
      case 'subscription_renewed':
        return 'active';
      case 'subscription_canceled':
        return 'canceled';
      case 'subscription_renewal_refused':
        return 'past_due';
      case 'refund':
        return 'refunded';
      case 'chargeback':
        return 'chargeback';
      default:
        return 'pending';
    }
  }

  const statusMap: Record<string, string> = {
    active: 'active',
    paid: 'active',
    inactive: 'past_due',
    canceled: 'canceled',
    expired: 'expired',
    paused: 'past_due',
    trial: 'active',
    refunded: 'refunded',
    chargedback: 'chargeback',
    waiting_payment: 'pending',
    processing: 'pending',
    refused: 'past_due',
  };

  return statusMap[caktoStatus] || 'pending';
}
