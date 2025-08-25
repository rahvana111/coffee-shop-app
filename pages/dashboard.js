import { useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';

// Dashboard for owners. Shows simple reports of sales and a list of all
// orders. In a more complete system you might add charts and filtering by
// date. This example keeps it minimal.
export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) {
        setOrders(data || []);
        const revenue = (data || [])
          .filter(o => o.payment_status === 'PAID')
          .reduce((sum, o) => sum + (o.total || 0), 0);
        setTotalRevenue(revenue);
      }
      setLoading(false);
    }
    loadOrders();
  }, []);

  return (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Dashboard Pemilik</h1>
      {loading && <p>Memuat…</p>}
      {!loading && (
        <>
          <p><strong>Total Pendapatan (dibayar):</strong> Rp {totalRevenue.toLocaleString('id-ID')}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>ID</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Meja</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Status</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Pembayaran</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Total</th>
                <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{order.id.slice(0, 8)}…</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{order.table_code}</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{order.status}</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{order.payment_status}</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Rp {order.total?.toLocaleString('id-ID')}</td>
                  <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{new Date(order.created_at).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
