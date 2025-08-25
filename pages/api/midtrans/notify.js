// Webhook endpoint for Midtrans payment notifications.
// Midtrans will POST payment status to this URL. We verify the
// signature for security and then update the order's payment_status
// accordingly in Supabase. You must configure this URL in your
// Midtrans dashboard (Settings → Notification URL).

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    // Parse JSON body
    const body = req.body;
    // Midtrans sends signature_key for verification. Compute local
    // signature: sha512(order_id + status_code + gross_amount + serverKey)
    const {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      transaction_status: transactionStatus,
      signature_key: signatureKey,
    } = body;
    // Compute local signature using server key from env (secret)
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const localSignature = crypto
      .createHash('sha512')
      .update(orderId + statusCode + grossAmount + serverKey)
      .digest('hex');
    if (signatureKey !== localSignature) {
      console.warn('Invalid Midtrans signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
    // Determine new payment status based on transaction_status
    let paymentStatus;
    switch (transactionStatus) {
      case 'capture':
      case 'settlement':
      case 'success':
        paymentStatus = 'PAID';
        break;
      case 'pending':
        paymentStatus = 'UNPAID';
        break;
      case 'cancel':
      case 'deny':
      case 'expire':
      case 'failure':
        paymentStatus = 'CANCELLED';
        break;
      default:
        paymentStatus = 'UNPAID';
        break;
    }
    // Update the order in Supabase using service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );
    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_status: paymentStatus })
      .eq('id', orderId);
    if (updateError) throw updateError;
    // Respond 200 OK to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Webhook processing error' });
  }
}
