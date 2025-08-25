import { useEffect, useState } from 'react';
import supabase from '../lib/supabaseClient';
import { formatRupiah } from '../utils/currency';

export default function Home() {
  const [menus, setMenus] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState(null);

  // Read table code from query string. Defaults to "TB01" when not
  // provided. When QR codes are generated for each table they should
  // include a ?table=TBXX parameter so that orders are associated
  // correctly.
  const tableCode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('table') || 'TB01' : 'TB01';

  useEffect(() => {
    // Fetch active menu items on component mount. Only active items are
    // displayed. If something goes wrong the menu will remain empty.
    const loadMenus = async () => {
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (!error) {
        setMenus(data);
      }
    };
    loadMenus();
  }, []);

  function addToCart(menu) {
    setCart(current => {
      const existing = current.find(item => item.id === menu.id);
      if (existing) {
        return current.map(item =>
          item.id === menu.id ? { ...item, qty: item.qty + 1 } : item,
        );
      }
      return [...current, { id: menu.id, name: menu.name, price: menu.price, qty: 1 }];
    });
  }

  function increment(menuId) {
    setCart(current =>
      current.map(item => (item.id === menuId ? { ...item, qty: item.qty + 1 } : item)),
    );
  }

  function decrement(menuId) {
    setCart(current => {
      return current
        .map(item => (item.id === menuId ? { ...item, qty: item.qty - 1 } : item))
        .filter(item => item.qty > 0);
    });
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  async function handleCheckout() {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_code: tableCode, items: cart }),
      });
      const data = await res.json();
      setPayment(data);
      // After sending order, clear the cart
      setCart([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Pesan Menu</h1>
      <p style={{ marginBottom: '0.5rem' }}>Meja: {tableCode}</p>
      {menus.length === 0 && <p>Loading menu…</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        {menus.map(menu => (
          <div key={menu.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: '0.5rem' }}>
            {menu.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={menu.image_url} alt={menu.name} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4 }} />
            )}
            <h2 style={{ fontSize: '1rem', fontWeight: 'bold' }}>{menu.name}</h2>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{formatRupiah(menu.price)}</p>
            <button onClick={() => addToCart(menu)} style={{ padding: '0.5rem', width: '100%', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 4 }}>Tambah</button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Keranjang</h2>
        {cart.length === 0 && <p>Keranjang kosong</p>}
        {cart.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div>
              <strong>{item.name}</strong> × {item.qty}
            </div>
            <div>
              <button onClick={() => decrement(item.id)} style={{ marginRight: 8 }}>-</button>
              <button onClick={() => increment(item.id)}>+</button>
              <span style={{ marginLeft: 8 }}>{formatRupiah(item.qty * item.price)}</span>
            </div>
          </div>
        ))}
        {cart.length > 0 && (
          <>
            <p><strong>Total: {formatRupiah(total)}</strong></p>
            <button onClick={handleCheckout} disabled={loading} style={{ padding: '0.5rem 1rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 4 }}>
              {loading ? 'Memproses…' : 'Pesan & Bayar (QRIS)'}
            </button>
          </>
        )}
      </div>
      {payment && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem' }}>Pembayaran</h2>
          {payment.qr_url ? (
            <div>
              <p>Silakan scan QR di bawah ini untuk membayar.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payment.qr_url} alt="QRIS" style={{ width: 200, height: 200 }} />
            </div>
          ) : (
            <p>Link pembayaran: <a href={payment.snap_url} target="_blank" rel="noopener noreferrer">Bayar di sini</a></p>
          )}
        </div>
      )}
    </div>
  );
}
