import { useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';

// Simple KDS (Kitchen Display System) page. This page shows the list of
// incoming orders and allows a barista to update the order status. It
// polls the Supabase database every few seconds to fetch new orders. In a
// production system you would use Supabase realtime channels for more
// efficient updates. For demonstration purposes polling is easier to
// understand.
export default function KdsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch orders periodically. Only show orders that are not done yet.
  useEffect(() => {
    let timer;
    async function fetchOrders() {
      const { data, error } = await supabase
        .from('orders')
        .select('id, table_code, status, total, created_at')
        .in('status', ['NEW', 'BREW', 'READY'])
        .order('created_at', { ascending: false });
      if (!error) {
        setOrders(data || []);
      }
      setLoading(false);
    }
    // initial load
    fetchOrders();
    // poll every 5 seconds
    timer = setInterval(fetchOrders, 5000);
    return () => clearInterval(timer);
  }, []);

  async function updateStatus(orderId, status) {
    // Update order status in Supabase. This uses the public anon key. For
    // production you should secure this with Row Level Security or call a
    // server-side API route using the service role. Here we do it client
    // side for simplicity. After updating, refresh the list.
    await supabase.from('orders').update({ status }).eq('id', orderId);
    // refresh immediately
    const { data } = await supabase
      .from('orders')
      .select('id, table_code, status, total, created_at')
      .in('status', ['NEW', 'BREW', 'READY'])
      .order('created_at', { ascending: false });
    setOrders(data || []);
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>KDS (Dapur/Bar)</h1>
      {loading && <p>Memuat…</p>}
      {!loading && orders.length === 0 && <p>Tidak ada pesanan saat ini.</p>}
      {orders.map(order => (
        <div key={order.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <strong>Meja {order.table_code}</strong>
            <span>Status: {order.status}</span>
          </div>
          <div>Total: Rp {order.total?.toLocaleString('id-ID')}</div>
          <div style={{ marginTop: '0.5rem' }}>
            {['NEW', 'BREW', 'READY', 'DONE'].map(s => (
              <button
                key={s}
                onClick={() => updateStatus(order.id, s)}
                style={{ marginRight: 8, padding: '0.3rem 0.5rem', background: order.status === s ? '#0070f3' : '#f0f0f0', color: order.status === s ? '#fff' : '#000', border: 'none', borderRadius: 4 }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}