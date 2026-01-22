import React, { useEffect, useState } from 'react';
import './consultant.css';

export default function Consultant() {
	const [pending, setPending] = useState([]);
	// new: artisan signup requests
	const [artisanRequests, setArtisanRequests] = useState([]);

	function loadPending() {
		try {
			const all = JSON.parse(localStorage.getItem('pendingProducts') || '[]');
			setPending(Array.isArray(all) ? all : []);
		} catch (e) {
			setPending([]);
		}
	}

	function loadArtisanRequests() {
		try {
			const reqs = JSON.parse(localStorage.getItem('artisanRequests') || '[]');
			setArtisanRequests(Array.isArray(reqs) ? reqs : []);
		} catch (e) {
			setArtisanRequests([]);
		}
	}

	useEffect(() => {
		loadPending();
		loadArtisanRequests();
	}, []);

	// Approve: move product from pendingProducts -> adminProducts
	function approveProduct(id) {
		try {
			const pendingList = JSON.parse(localStorage.getItem('pendingProducts') || '[]');
			const adminList = JSON.parse(localStorage.getItem('adminProducts') || '[]');

			const idx = (Array.isArray(pendingList) ? pendingList : []).findIndex(p => String(p.id) === String(id));
			if (idx === -1) return alert('Product not found');

			const product = pendingList[idx];
			const approvedProduct = { ...product, status: 'approved' };

			const nextPending = pendingList.filter((p, i) => i !== idx);
			const nextAdmin = [approvedProduct, ...(Array.isArray(adminList) ? adminList : [])];

			localStorage.setItem('pendingProducts', JSON.stringify(nextPending));
			localStorage.setItem('adminProducts', JSON.stringify(nextAdmin));

			setPending(nextPending);
			alert(`Product "${product.name}" approved and published.`);
		} catch (e) {
			console.error(e);
			alert('Failed to approve product.');
		}
	}

	// Reject: remove from pendingProducts and store in rejectedProducts (optional)
	function rejectProduct(id, reason = '') {
		try {
			const pendingList = JSON.parse(localStorage.getItem('pendingProducts') || '[]');
			const idx = (Array.isArray(pendingList) ? pendingList : []).findIndex(p => String(p.id) === String(id));
			if (idx === -1) return alert('Product not found');

			const product = pendingList[idx];
			const nextPending = pendingList.filter((p, i) => i !== idx);

			// optional: keep rejected list for auditing
			const rejected = JSON.parse(localStorage.getItem('rejectedProducts') || '[]');
			const rejectedEntry = { ...product, rejectedAt: new Date().toISOString(), reason };
			localStorage.setItem('rejectedProducts', JSON.stringify([rejectedEntry, ...(Array.isArray(rejected) ? rejected : [])]));

			localStorage.setItem('pendingProducts', JSON.stringify(nextPending));
			setPending(nextPending);
			alert(`Product "${product.name}" rejected.`);
		} catch (e) {
			console.error(e);
			alert('Failed to reject product.');
		}
	}

	// Approve artisan signup: move request -> artisans
	function approveArtisan(id) {
		try {
			const reqs = JSON.parse(localStorage.getItem('artisanRequests') || '[]');
			const idx = (Array.isArray(reqs) ? reqs : []).findIndex(r => String(r.id) === String(id));
			if (idx === -1) return alert('Request not found');

			const req = reqs[idx];
			const approved = { id: `artisan_${Date.now()}`, username: req.username, password: req.password, phone: req.phone, approvedAt: new Date().toISOString() };
			const artisans = JSON.parse(localStorage.getItem('artisans') || '[]');
			localStorage.setItem('artisans', JSON.stringify([approved, ...(Array.isArray(artisans) ? artisans : [])]));

			const next = reqs.filter((r,i) => i !== idx);
			localStorage.setItem('artisanRequests', JSON.stringify(next));
			setArtisanRequests(next);
			alert(`Artisan "${req.username}" approved.`);
		} catch (e) {
			console.error(e);
			alert('Failed to approve artisan request.');
		}
	}

	// Reject artisan signup
	function rejectArtisan(id, reason = '') {
		try {
			const reqs = JSON.parse(localStorage.getItem('artisanRequests') || '[]');
			const idx = (Array.isArray(reqs) ? reqs : []).findIndex(r => String(r.id) === String(id));
			if (idx === -1) return alert('Request not found');
			const req = reqs[idx];
			const next = reqs.filter((r,i) => i !== idx);
			localStorage.setItem('artisanRequests', JSON.stringify(next));
			const rejected = JSON.parse(localStorage.getItem('rejectedArtisans') || '[]');
			localStorage.setItem('rejectedArtisans', JSON.stringify([{ ...req, rejectedAt: new Date().toISOString(), reason }, ...(Array.isArray(rejected) ? rejected : [])]));
			setArtisanRequests(next);
			alert(`Artisan "${req.username}" rejected.`);
		} catch (e) {
			console.error(e);
			alert('Failed to reject artisan request.');
		}
	}

	// add logout handler
	const handleLogout = () => {
		localStorage.removeItem('user');
		localStorage.removeItem('cart');
		window.location.href = '/';
	};

	if (!pending.length && (!artisanRequests || artisanRequests.length === 0)) {
		return (
			<div className="consultant-container">
				<header className="consultant-header" style={{color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
					<h1>Consultant Panel</h1>
					<nav>
						<button
							onClick={handleLogout}
							style={{ marginLeft: '12px', padding: '8px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
						>
							Logout
						</button>
					</nav>
				</header>
				<div className="consultant-empty">No pending products to review.</div>
				{/* show artisan requests empty message too */}
				{(!artisanRequests || artisanRequests.length === 0) && <div style={{ marginTop: 12 }}>No artisan signup requests.</div>}
			</div>
		);
	}

	return (
		<div className="consultant-container">
			<header className="consultant-header">
				<h1>Consultant Panel — Pending Products</h1>
				<button className="refresh" onClick={loadPending}>Refresh</button>
				<nav>
					<button
						onClick={handleLogout}
						style={{ marginLeft: '12px', padding: '8px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
					>
						Logout
					</button>
				</nav>
			</header>

			<ul className="pending-list">
				{pending.map(p => (
					<li key={p.id} className="pending-card">
						<div className="pending-left">
							<img src={p.imageUrl} alt={p.name} />
						</div>
						<div className="pending-body">
							<div className="pending-title">{p.name} <span className="pending-meta">ID: {p.id}</span></div>
							<div className="pending-desc">{p.description}</div>
							<div className="pending-info">Price: ₹{(p.price || 0).toFixed(2)} • Artisan: {p.artisanId || 'unknown'}</div>
							<div className="pending-actions">
								<button className="approve" onClick={() => approveProduct(p.id)}>Approve</button>
								<button className="reject" onClick={() => {
									const r = window.prompt('Optional rejection reason (leave empty to skip):', '');
									rejectProduct(p.id, r || '');
								}}>Reject</button>
							</div>
						</div>
					</li>
				))}
			</ul>

			{/* New: Artisan Signup Requests */}
			{artisanRequests && artisanRequests.length > 0 && (
				<div style={{ marginTop: 24 }}>
					<h2 style={{ color: '#fff' }}>Artisan Signup Requests</h2>
					<ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
						{artisanRequests.map(r => (
							<li key={r.id} style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 8 }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<div>
										<strong>{r.username}</strong> • {r.phone} • requested: {new Date(r.requestedAt).toLocaleString()}
									</div>
									<div style={{ display: 'flex', gap: 8 }}>
										<button onClick={() => approveArtisan(r.id)} style={{ padding: '6px 10px', background: '#2f8b36', color: '#fff', border: 'none', borderRadius: 8 }}>Approve</button>
										<button onClick={() => { const rr = window.prompt('Optional reject reason',''); rejectArtisan(r.id, rr||''); }} style={{ padding: '6px 10px', background: '#e55353', color: '#fff', border:'none', borderRadius:8 }}>Reject</button>
									</div>
								</div>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
