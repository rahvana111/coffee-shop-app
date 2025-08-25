// API route to create an order and initiate payment via Midtrans. This
// endpoint runs on the server (serverless function) and therefore has
// access to secret environment variables (service role key, server key).

import { createClient } from '@supabase/supabase-js';

// Generate a unique order id. Use timestamp and random bytes so it's
// unique enough for Midtrans requirements (must be less than 50
// characters). Alternatively you could use uuid.
function generateOrderId() {
  const rand = Math.random().toString(36).substring(2, 8);
  return `ORDER-${Date.now()}-${rand}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { table_code, items } = req.body;
  if (!table_code || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Invalid request' });
    return;
  }
  // Calculate total from items to avoid trusting client-provided total
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const orderId = generateOrderId();
  try {
    // Insert into Supabase using service role key so we can bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );
    // Insert order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        id: orderId,
        table_code,
        status: 'NEW',
        payment_status: 'UNPAID',
        total,
      })
      .select()
      .single();
    if (orderError) throw orderError;
    // Insert order_items
    const orderItems = items.map(item => ({
      order_id: orderId,
      menu_id: item.id,
      qty: item.qty,
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw itemsError;
    // Call Midtrans to create a QRIS payment
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';
    const baseUrl = isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const auth = Buffer.from(serverKey + ':').toString('base64');
    // Construct request body for QRIS via Core API v2/charge
    const chargeBody = {
      payment_type: 'qris',
      transaction_details: {
        order_id: orderId,
        gross_amount: total,
      },
      item_details: items.map(item => ({
        id: item.id,
        price: item.price,
        quantity: item.qty,
        name: item.name.substring(0, 50),
      })),
    };
    const midtransRes = await fetch(`${baseUrl}/v2/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(chargeBody),
    });
    const midtransData = await midtransRes.json();
    // The response contains an `actions` array with a `generate-qr-code` URL.
    let qrUrl;
    if (midtransData.actions && Array.isArray(midtransData.actions)) {
      const qrAction = midtransData.actions.find(a => a.name === 'generate-qr-code');
      if (qrAction) qrUrl = qrAction.url;
    }
    // Save the payment token or QR string if needed. For this demo we just
    // return the qr_url so the client can display it. The order id is
    // returned so the client can reference it later.
    res.status(200).json({ order_id: orderId, qr_url: qrUrl, snap_url: midtransData.redirect_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  }
}