import React, { useEffect, useState } from 'react';
import './admin.css';

export default function AdminDashboard() {
	const [orders, setOrders] = useState([]);
	const [chartTooltip, setChartTooltip] = useState(''); // text for chart hover
	const [chartTooltipVisible, setChartTooltipVisible] = useState(false);

	// counts derived from registered users (signup)
	const [storedCustomersCount, setStoredCustomersCount] = useState(0);
	const [storedArtisansCount, setStoredArtisansCount] = useState(0);

	// full lists for display and management
	const [storedCustomersList, setStoredCustomersList] = useState([]);
	const [storedArtisansList, setStoredArtisansList] = useState([]);

	// new: product feedbacks
	const [productFeedbacks, setProductFeedbacks] = useState([]);

	function loadOrders() {
		try {
			const all = JSON.parse(localStorage.getItem('orders') || '[]');
			setOrders(Array.isArray(all) ? all : []);
		} catch (e) {
			setOrders([]);
		}
		// also refresh stored user counts when reloading orders (useful after signup)
		loadUserCounts();
		loadUserLists();
	}

	// load counts of registered customers and approved artisans from localStorage
	function loadUserCounts() {
		try {
			const customers = JSON.parse(localStorage.getItem('customers') || '[]');
			setStoredCustomersCount(Array.isArray(customers) ? customers.length : 0);
		} catch (e) {
			setStoredCustomersCount(0);
		}
		try {
			const artisans = JSON.parse(localStorage.getItem('artisans') || '[]');
			setStoredArtisansCount(Array.isArray(artisans) ? artisans.length : 0);
		} catch (e) {
			setStoredArtisansCount(0);
		}
	}

	// load full lists for display
	function loadUserLists() {
		try {
			const customers = JSON.parse(localStorage.getItem('customers') || '[]');
			setStoredCustomersList(Array.isArray(customers) ? customers : []);
		} catch (e) {
			setStoredCustomersList([]);
		}
		try {
			const artisans = JSON.parse(localStorage.getItem('artisans') || '[]');
			setStoredArtisansList(Array.isArray(artisans) ? artisans : []);
		} catch (e) {
			setStoredArtisansList([]);
		}
	}

	// delete a customer by id
	function deleteCustomer(id) {
		if (!window.confirm('Delete this customer?')) return;
		try {
			const customers = JSON.parse(localStorage.getItem('customers') || '[]');
			const next = (Array.isArray(customers) ? customers : []).filter(c => String(c.id) !== String(id));
			localStorage.setItem('customers', JSON.stringify(next));
			loadUserCounts();
			loadUserLists();
			alert('Customer deleted');
		} catch (e) {
			console.error(e);
			alert('Failed to delete customer');
		}
	}

	// delete an artisan by id
	function deleteArtisan(id) {
		if (!window.confirm('Delete this artisan?')) return;
		try {
			const artisans = JSON.parse(localStorage.getItem('artisans') || '[]');
			const next = (Array.isArray(artisans) ? artisans : []).filter(a => String(a.id) !== String(id));
			localStorage.setItem('artisans', JSON.stringify(next));
			loadUserCounts();
			loadUserLists();
			alert('Artisan deleted');
		} catch (e) {
			console.error(e);
			alert('Failed to delete artisan');
		}
	}

	// load product feedbacks from localStorage
	function loadProductFeedbacks() {
		try {
			const f = JSON.parse(localStorage.getItem('productFeedbacks') || '[]');
			setProductFeedbacks(Array.isArray(f) ? f : []);
		} catch (e) {
			setProductFeedbacks([]);
		}
	}

	function deleteFeedbackById(id) {
		if (!window.confirm('Delete this feedback?')) return;
		try {
			const f = JSON.parse(localStorage.getItem('productFeedbacks') || '[]');
			const next = (Array.isArray(f) ? f : []).filter(x => String(x.id) !== String(id));
			localStorage.setItem('productFeedbacks', JSON.stringify(next));
			loadProductFeedbacks();
			alert('Feedback deleted');
		} catch (e) {
			console.error(e);
			alert('Failed to delete feedback');
		}
	}

	useEffect(() => {
		loadOrders();
		loadProductFeedbacks();
		// also watch for storage updates across tabs
		const onStorage = (e) => {
			if (!e.key || e.key === 'orders') loadOrders();
			if (!e.key || e.key === 'productFeedbacks') loadProductFeedbacks();
			// if customers/artisans change in another tab, update counts
			if (!e.key || e.key === 'customers' || e.key === 'artisans' || e.key === 'artisanRequests') {
				loadUserCounts();
				loadUserLists();
			}
		};
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	}, []);

	function orderTotal(order) {
		if (!order || !Array.isArray(order.items)) return 0;
		return order.items.reduce((sum, it) => {
			const price = parseFloat((it && (it.price ?? it.amount ?? 0)) || 0) || 0;
			const qty = parseInt(it.quantity || 1, 10) || 1;
			return sum + price * qty;
		}, 0);
	}

	const totalOrders = orders.length;
	const totalRevenue = orders.reduce((s, o) => s + orderTotal(o), 0);
	const avgOrderValue = totalOrders ? (totalRevenue / totalOrders) : 0;

	const perArtisan = orders.reduce((acc, o) => {
		const aid = o.artisanId || 'unknown';
		const val = orderTotal(o);
		if (!acc[aid]) acc[aid] = { orders: 0, revenue: 0 };
		acc[aid].orders += 1;
		acc[aid].revenue += val;
		return acc;
	}, {});

	// --- new: compute unique customers and artisans for graphical stats ---
	// keep the old order-derived values as a fallback
	const uniqueCustomers = Array.from(new Set(orders.map(o => o.customerId).filter(Boolean)));
	const uniqueArtisans = Array.from(new Set(
		orders.flatMap(o => {
			const ids = [];
			if (o.artisanId) ids.push(o.artisanId);
			if (Array.isArray(o.items)) {
				o.items.forEach(it => {
					if (it && (it.artisanId || it.addedBy || it.seller || (it.merchant && it.merchant.id))) {
						ids.push(it.artisanId || it.addedBy || it.seller || (it.merchant && it.merchant.id));
					}
				});
			}
			return ids;
		}).filter(Boolean)
	));

	// prefer registered user counts from localStorage (reflect signups); fall back to order-derived unique counts
	const customersCount = storedCustomersCount || uniqueCustomers.length;
	const artisansCount = storedArtisansCount || uniqueArtisans.length;

	const totalEntities = customersCount + artisansCount;
	const customersPercent = totalEntities ? (customersCount / totalEntities) * 100 : 0;

	// donut geometry
	const r = 36;
	const circumference = 2 * Math.PI * r;
	const dashCustomers = (customersPercent / 100) * circumference;
	const dashOffset = circumference - dashCustomers;
	// --- end new ---

	// --- helper used in rendering for item images ---
	function itemImageSrc(it) {
		return (it && (it.imageUrl || it.image || it.img || it.thumbnail || it.thumb)) || '';
	}

	// new: resolve product info (image, name, artisanId) by id from localStorage buckets
	function getProductInfo(productId) {
		try {
			const adminProducts = JSON.parse(localStorage.getItem('adminProducts') || '[]');
			const pendingProducts = JSON.parse(localStorage.getItem('pendingProducts') || '[]');
			const all = [...(Array.isArray(adminProducts) ? adminProducts : []), ...(Array.isArray(pendingProducts) ? pendingProducts : [])];
			const p = all.find(x => String(x.id) === String(productId));
			if (p) return { name: p.name || 'Unknown Product', imageUrl: p.imageUrl || p.image || '', artisanId: p.artisanId || p.addedBy || p.owner || null };
		} catch (e) { /* ignore */ }
		return { name: `Product ${productId}`, imageUrl: '', artisanId: null };
	}

	// new: resolve artisan display name by id from localStorage 'artisans'
	function getArtisanNameById(artisanId) {
		if (!artisanId) return 'Unknown Artisan';
		try {
			const artisans = JSON.parse(localStorage.getItem('artisans') || '[]');
			const a = (Array.isArray(artisans) ? artisans : []).find(x => String(x.id) === String(artisanId) || x.username === artisanId);
			if (a) return a.username || a.name || String(artisanId);
		} catch (e) { /* ignore */ }
		return String(artisanId);
	}

	// add logout handler
	const handleLogout = () => {
		localStorage.removeItem('user');
		localStorage.removeItem('cart');
		window.location.href = '/';
	};

	// --- REPLACED: single header (was previously two headers and referenced undefined functions) ---
	return (
		// set text color to black for this admin page
		<div className="admin-container" style={{ color: 'black' }}>
			<header className="admin-header">
				<h1>Admin Panel - Product Management</h1>
				<div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
					<button className="btn refresh-btn" onClick={loadOrders}>Refresh</button>
					<button onClick={handleLogout} className="nav-btn logout">Logout</button>
				</div>
			</header>

			{/* Admin panel banner added */}
			<div className="admin-panel-banner" style={{ marginBottom: 12 }}>
				<h1 style={{ margin: 0, fontSize: '1.5rem', color: '#2b2b2b' }}>Admin Panel</h1>
			</div>

			<section className="admin-stats">
				<div className="stat">
					<span className="label">Total Orders</span>
					<span className="value">{totalOrders}</span>
				</div>
				<div className="stat">
					<span className="label">Total Revenue</span>
					<span className="value">₹{totalRevenue.toFixed(2)}</span>
				</div>
				<div className="stat">
					<span className="label">Average Order Value</span>
					<span className="value">₹{avgOrderValue.toFixed(2)}</span>
				</div>
			</section>

			{/* --- new: Graphical statistics section --- */}
			<section className="charts-section">
				<h3>Graphical Overview</h3>
				<div className="charts">
					<div className="donut-chart" 
					     onMouseEnter={() => { setChartTooltip(`${customersCount} customers — ${customersPercent.toFixed(0)}%`); setChartTooltipVisible(true); }}
					     onMouseLeave={() => { setChartTooltip(''); setChartTooltipVisible(false); }}>
						<svg className="donut" viewBox="0 0 100 100" width="120" height="120" role="img" aria-label="Customers vs Artisans">
							<defs>
								<linearGradient id="donutGradCustomers" x1="0%" y1="0%" x2="100%" y2="0%">
									<stop offset="0%" stopColor="#86e07b" />
									<stop offset="100%" stopColor="#34c759" />
								</linearGradient>
							</defs>
							<g transform="translate(50,50)">
								{/* background ring */}
								<circle r={r} fill="transparent" className="donut-bg" strokeWidth="14" />
								{/* customers slice using gradient stroke */}
								<circle
									r={r}
									fill="transparent"
									className="donut-customers"
									stroke="url(#donutGradCustomers)"
									strokeWidth="14"
									strokeLinecap="round"
									style={{
										transform: 'rotate(-90deg)',
										transformOrigin: '50% 50%',
										transition: 'stroke-dasharray 420ms ease, stroke-dashoffset 420ms ease'
									}}
									strokeDasharray={`${dashCustomers} ${circumference}`}
									strokeDashoffset={dashOffset}
								/>
							</g>
						</svg>
						<div className="donut-legend">
							<div className="legend-row"><span className="legend-swatch customers"></span>Customers: <strong>{customersCount}</strong></div>
							<div className="legend-row"><span className="legend-swatch artisans"></span>Artisans: <strong>{artisansCount}</strong></div>
						</div>
					</div>

					<div className="bar-chart">
						<div className="bar-row" 
						     onMouseEnter={() => { setChartTooltip(`Customers: ${customersCount}`); setChartTooltipVisible(true); }}
						     onMouseLeave={() => { setChartTooltip(''); setChartTooltipVisible(false); }}>
							<div className="bar-label">Customers</div>
							<div className="bar-wrap">
								<div
									className="bar-fill customers-fill"
									style={{ width: `${totalEntities ? (customersCount / Math.max(customersCount, artisansCount)) * 100 : 0}%` }}
								/>
							</div>
							<div className="bar-value">{customersCount}</div>
						</div>

						<div className="bar-row"
						     onMouseEnter={() => { setChartTooltip(`Artisans: ${artisansCount}`); setChartTooltipVisible(true); }}
						     onMouseLeave={() => { setChartTooltip(''); setChartTooltipVisible(false); }}>
							<div className="bar-label">Artisans</div>
							<div className="bar-wrap">
								<div
									className="bar-fill artisans-fill"
									style={{ width: `${totalEntities ? (artisansCount / Math.max(customersCount, artisansCount)) * 100 : 0}%` }}
								/>
							</div>
							<div className="bar-value">{artisansCount}</div>
						</div>
					</div>
				</div>

				{/* tooltip area below charts (appears when hovering parts) */}
				{chartTooltipVisible && (
					<div className="chart-tooltip" role="status" style={{ color: 'black' }}>
						{chartTooltip}
					</div>
				)}
			</section>
			{/* --- end new --- */}

			<section className="artisan-stats">
				<h3>Revenue by Artisan</h3>
				{Object.keys(perArtisan).length === 0 ? (
					<p className="muted">No artisan data</p>
				) : (
					<ul className="artisan-list">
						{Object.entries(perArtisan).map(([aid, data]) => (
							<li key={aid} className="artisan-item">
								<span className="artisan-id">{aid}</span>
								<span className="artisan-meta">orders: {data.orders}</span>
								<span className="artisan-meta">revenue: ₹{data.revenue.toFixed(2)}</span>
							</li>
						))}
					</ul>
				)}
			</section>

			{/* Registered users (customers & artisans) */}
			<section className="registered-users" style={{ marginTop: 12, marginBottom: 16 }}>
				<h3>Registered Users</h3>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
					{/* Customers */}
					<div style={{ background: 'var(--card)', padding: 12, borderRadius: 10 }}>
						<h4>Customers ({storedCustomersCount})</h4>
						{storedCustomersList.length === 0 ? <p className="muted">No customers</p> : (
							<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
								{storedCustomersList.map(c => (
									<li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderBottom: '1px dashed rgba(0,0,0,0.04)' }}>
										<div>
											<div style={{ fontWeight: 800 }}>{c.username}</div>
											<div style={{ color: '#6b7280' }}>{c.phone} • {c.id}</div>
										</div>
										<button onClick={() => deleteCustomer(c.id)} style={{ background: '#e55353', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>Delete</button>
									</li>
								))}
							</ul>
						)}
					</div>

					{/* Artisans */}
					<div style={{ background: 'var(--card)', padding: 12, borderRadius: 10 }}>
						<h4>Artisans ({storedArtisansCount})</h4>
						{storedArtisansList.length === 0 ? <p className="muted">No artisans</p> : (
							<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
								{storedArtisansList.map(a => (
									<li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderBottom: '1px dashed rgba(0,0,0,0.04)' }}>
										<div>
											<div style={{ fontWeight: 800 }}>{a.username}</div>
											<div style={{ color: '#6b7280' }}>{a.phone} • {a.id}</div>
										</div>
										<button onClick={() => deleteArtisan(a.id)} style={{ background: '#e55353', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>Delete</button>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			</section>

			{/* --- new: Product Feedbacks section --- */}
			<section className="product-feedbacks" style={{ marginTop: 12 }}>
				<h3>Product Feedbacks</h3>
				{productFeedbacks.length === 0 ? <p className="muted" style={{ color: 'black' }}>No feedback yet.</p> : (
					<ul style={{ listStyle: 'none', padding: 0 }}>
						{productFeedbacks.map(f => {
							const info = getProductInfo(f.productId);
							const artisanName = getArtisanNameById(info.artisanId);
							return (
								<li key={f.id} style={{ background: 'var(--card)', padding: 10, borderRadius: 8, marginBottom: 8 }}>
									<div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
										<div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
											{/* product thumbnail */}
											{info.imageUrl ? (
												<img src={info.imageUrl} alt={info.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }} onError={(e)=>{e.currentTarget.style.display='none'}} />
											) : (
												<div style={{ width: 72, height: 72, borderRadius: 8, background: '#f3f6fb', display:'flex',alignItems:'center',justifyContent:'center',color:'#6b7280' }}>No Image</div>
											)}

											{/* product + artisan + feedback text */}
											<div>
												<div style={{ fontWeight: 800 }}>{info.name}</div>
												<div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>By: {artisanName} • {new Date(f.date).toLocaleString()}</div>
												<div style={{ marginTop: 8, color: '#333' }}>{f.text}</div>
												<div style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>Feedback by: {f.authorName}</div>
											</div>
										</div>

										{/* admin delete */}
										<div>
											<button onClick={() => deleteFeedbackById(f.id)} style={{ background:'#e55353', color:'#fff', border:'none', padding:'6px 10px', borderRadius:8, cursor:'pointer' }}>Delete</button>
										</div>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</section>
			{/* --- end new --- */}

			<section className="orders-section">
				<h3>Orders</h3>
				{orders.length === 0 ? (
					<p className="muted">No orders placed yet.</p>
				) : (
					<ul className="orders-list">
						{orders.map(o => (
							<li key={o.id} className="order-card">
								<div className="order-header">
									<div>
										<strong>Order ID:</strong> {o.id} — <strong>Date:</strong> {o.date} — <strong>Status:</strong> <span className={`status ${o.status}`}>{o.status}</span>
									</div>
									<div><strong>Customer:</strong> {o.customerId || 'unknown'}</div>
								</div>

								<div className="order-items">
									<strong>Items:</strong>
									<ul className="item-list">
										{(o.items || []).map((it, i) => {
											const imgSrc = itemImageSrc(it);
											return (
												<li key={i} className="order-item-row">
													{imgSrc ? <img src={imgSrc} alt={it.name || it.title} className="item-image" loading="lazy" onError={(e)=>{e.currentTarget.style.display='none'}} /> : <div className="item-image placeholder" />}
													<div className="item-body">
														<div className="item-title">{it.name || it.title}</div>
														<div className="item-meta">qty: {it.quantity || 1} • ₹{(parseFloat(it.price || it.amount || 0) || 0).toFixed(2)}</div>
													</div>
												</li>
											);
										})}
									</ul>
								</div>

								<div className="order-footer" style={{ marginTop: 10 }}>
									<strong>Order Total:</strong> ₹{orderTotal(o).toFixed(2)}
								</div>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
