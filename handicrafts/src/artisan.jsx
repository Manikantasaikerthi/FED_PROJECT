import React, { useEffect, useState, useRef } from 'react';
import './artisan.css';

function Artisan() {
	const [productForm, setProductForm] = useState({
		name: '',
		price: '',
		imageUrl: '',
		description: ''
	});
	const [products, setProducts] = useState([]);
	const [showProductList, setShowProductList] = useState(false);
	const [editingProduct, setEditingProduct] = useState(null);
	const [editingSource, setEditingSource] = useState(null); // 'pending' or 'approved'
	const [searchTerm, setSearchTerm] = useState('');
	const [artisanId, setArtisanId] = useState(null);
	const [orders, setOrders] = useState([]);
	const [showAllOrders, setShowAllOrders] = useState(false);

	// --- Speech recognition / translation state ---
	const [listening, setListening] = useState(false);
	const [transcript, setTranscript] = useState('');
	const recognitionRef = useRef(null);

	// add selected language for recognition/translation
	const [selectedLang, setSelectedLang] = useState('auto'); // 'auto' | en te hi ta ml kn pa mr bn

	// camera state & refs
	const [showCamera, setShowCamera] = useState(false);
	const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' | 'user'
	const videoRef = useRef(null);
	const canvasRef = useRef(null);
	const streamRef = useRef(null);

	// new: load product feedbacks (so artisan can read feedbacks for their products)
	const [productFeedbacks, setProductFeedbacks] = useState([]);
	const [showFeedbackListFor, setShowFeedbackListFor] = useState(null);

	useEffect(() => {
		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SpeechRecognition) {
			recognitionRef.current = null;
			return;
		}
		const recog = new SpeechRecognition();
		recog.lang = 'te-IN'; // Telugu
		recog.interimResults = true;
		recog.maxAlternatives = 1;

		recog.onresult = (event) => {
			let interim = '';
			let final = '';
			for (let i = event.resultIndex; i < event.results.length; ++i) {
				const r = event.results[i];
				if (r.isFinal) final += r[0].transcript;
				else interim += r[0].transcript;
			}
			setTranscript(final || interim);
			if (final) {
				translateTextAndSetDescription(final);
			}
		};

		recog.onerror = () => {
			setListening(false);
		};
		recog.onend = () => {
			setListening(false);
		};

		recognitionRef.current = recog;
	}, []);

	const toggleListening = () => {
		const recog = recognitionRef.current;
		if (!recog) {
			alert('Speech recognition not supported in this browser.');
			return;
		}
		// set recognition language according to selector (fallback to te-IN)
		try {
			const langMap = {
				en: 'en-US',
				te: 'te-IN',
				hi: 'hi-IN',
				ta: 'ta-IN',
				ml: 'ml-IN',
				kn: 'kn-IN',
				pa: 'pa-IN',
				mr: 'mr-IN',
				bn: 'bn-IN'
			};
			if (selectedLang && langMap[selectedLang]) recog.lang = langMap[selectedLang];
			else recog.lang = 'te-IN'; // default
		} catch (err) {
			// ignore if setting lang fails
		}

		if (listening) {
			recog.stop();
			setListening(false);
		} else {
			setTranscript('');
			try {
				recog.start();
				setListening(true);
			} catch (e) {
				console.warn(e);
			}
		}
	};

	// helper: detect script/language from transcript text using Unicode ranges
	function detectScriptLang(text) {
		if (!text || typeof text !== 'string') return null;
		// check for Indic scripts by Unicode ranges
		const ranges = [
			{ code: 'te', re: /[\u0C00-\u0C7F]/ }, // Telugu
			{ code: 'hi', re: /[\u0900-\u097F]/ }, // Devanagari (Hindi, Marathi, etc.)
			{ code: 'mr', re: /[\u0900-\u097F]/ }, // Marathi uses Devanagari too
			{ code: 'ta', re: /[\u0B80-\u0BFF]/ }, // Tamil
			{ code: 'ml', re: /[\u0D00-\u0D7F]/ }, // Malayalam
			{ code: 'kn', re: /[\u0C80-\u0CFF]/ }, // Kannada
			{ code: 'bn', re: /[\u0980-\u09FF]/ }, // Bengali
			{ code: 'pa', re: /[\u0A00-\u0A7F]/ }  // Gurmukhi (Punjabi)
		];
		for (const r of ranges) {
			if (r.re.test(text)) return r.code;
		}
		// if transcript is Latin but likely transliteration, return null to allow 'auto'
		return null;
	}

	// improved translate helper: detect script and request translation with detected source
	async function translateTextAndSetDescription(text) {
		// if user selected English, insert recognized English text directly (no translation required)
		if (selectedLang === 'en') {
			setProductForm(prev => ({
				...prev,
				description: prev.description ? prev.description + '\n' + text : text
			}));
			setTranscript('');
			return;
		}
		const LIBRE_URL = 'https://libretranslate.de/translate';
		const googleFallback = async (txt) => {
			const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=' + encodeURIComponent(txt);
			const r = await fetch(url);
			if (!r.ok) throw new Error('Google translate failed');
			const json = await r.json();
			if (Array.isArray(json)) return json[0].map(part => part[0]).join('');
			throw new Error('Unexpected Google response');
		};

		const applyTranslation = (translated) => {
			if (!translated || typeof translated !== 'string') return;
			setProductForm(prev => ({
				...prev,
				// append translated English text
				description: prev.description ? prev.description + '\n' + translated : translated
			}));
			setTranscript('');
		};

		// detect script-based language from the transcript text
		let detected = detectScriptLang(text); // may be 'te','hi','ta','ml','kn','pa','mr','bn' or null
		// prefer user selectedLang if it's explicit (not 'auto')
		let sourceLang = (selectedLang && selectedLang !== 'auto') ? selectedLang : (detected || 'auto');

		// try LibreTranslate first
		try {
			const res = await fetch(LIBRE_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					q: text,
					source: sourceLang,
					target: 'en',
					format: 'text'
				})
			});
			if (res.ok) {
				const data = await res.json();
				const translated = data.translatedText || data.translated || (data.result && data.result.translatedText) || '';
				if (translated) {
					applyTranslation(translated);
					return;
				}
			}
		} catch (err) {
			// LibreTranslate failed — fallthrough to fallback
		}

		// fallback to Google translate (auto-detect source)
		try {
			const translated = await googleFallback(text);
			if (translated) {
				applyTranslation(translated);
				return;
			}
		} catch (err) {
			// both failed
		}

		// final fallback: append original transcript so user isn't left empty
		setProductForm(prev => ({
			...prev,
			description: prev.description ? prev.description + '\n' + text : text
		}));
		setTranscript('');
	}

	useEffect(() => {
		// read current logged-in user id (artisan)
		try {
			const user = JSON.parse(localStorage.getItem('user') || 'null');
			if (user && user.id) setArtisanId(user.id);
		} catch (e) {
			setArtisanId(null);
		}
	}, []);

	// helper to check item references artisan
	function itemMatchesArtisan(item, id) {
		if (!item || !id) return false;
		const candidates = [
			item.artisanId,
			item.addedBy,
			item.seller,
			item.owner,
			item.postedBy,
			(item.merchant && item.merchant.id)
		];
		return candidates.some(c => c && String(c) === String(id));
	}

	function loadOrders() {
		try {
			const all = JSON.parse(localStorage.getItem('orders') || '[]');
			if (!artisanId && !showAllOrders) {
				setOrders([]);
				return;
			}

			// load adminProducts to detect ownership by product id (covers older products without explicit artisanId)
			const adminProducts = JSON.parse(localStorage.getItem('adminProducts') || '[]');
			const ownedProductIds = new Set();

			(Array.isArray(adminProducts) ? adminProducts : []).forEach(p => {
				if (!p) return;
				// product may store artisanId or other owner fields; be permissive
				if (p.artisanId && String(p.artisanId) === String(artisanId)) {
					if (p.id) ownedProductIds.add(String(p.id));
				} else if (p.owner && String(p.owner) === String(artisanId)) {
					if (p.id) ownedProductIds.add(String(p.id));
				} else if (p.addedBy && String(p.addedBy) === String(artisanId)) {
					if (p.id) ownedProductIds.add(String(p.id));
				}
			});

			// include products in current component state (in-memory) that belong to this artisan
			products.forEach(p => {
				if (!p) return;
				if (p.artisanId && String(p.artisanId) === String(artisanId)) {
					if (p.id) ownedProductIds.add(String(p.id));
				}
			});

			const source = Array.isArray(all) ? all : [];
			const mine = source.filter(o => {
				if (showAllOrders) return true; // admin-like view: show everything
				// match by top-level artisanId
				if (o.artisanId && String(o.artisanId) === String(artisanId)) return true;
				// match by any item-level reference
				if (Array.isArray(o.items) && o.items.some(it => itemMatchesArtisan(it, artisanId))) return true;
				// match if any item id corresponds to a product owned by this artisan
				if (Array.isArray(o.items) && o.items.some(it => it && it.id && ownedProductIds.has(String(it.id)))) return true;
				return false;
			});
			setOrders(mine);
		} catch (e) {
			setOrders([]);
		}
	}

	// update order status in localStorage and reload
	function updateOrderStatus(orderId, newStatus) {
		try {
			const all = JSON.parse(localStorage.getItem('orders') || '[]');
			if (!Array.isArray(all)) return;
			const idx = all.findIndex(o => String(o.id) === String(orderId));
			if (idx === -1) return;
			all[idx] = { ...all[idx], status: newStatus };
			localStorage.setItem('orders', JSON.stringify(all));
			// update local view
			loadOrders();
			alert(`Order ${orderId} marked ${newStatus}`);
		} catch (e) {
			console.error(e);
			alert('Failed to update order status');
		}
	}

	useEffect(() => {
		loadOrders();
		// also watch for storage updates across tabs
		const onStorage = (e) => {
			if (!e.key || e.key === 'orders') loadOrders();
		};
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	}, [artisanId, showAllOrders, products]);

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setProductForm(prev => ({
			...prev,
			[name]: value
		}));
	};

	// Add product -> push to pendingProducts, not adminProducts
	const handleAddProduct = () => {
		if (productForm.name && productForm.price && productForm.imageUrl && productForm.description) {
			const newProduct = {
				id: Date.now(),
				name: productForm.name,
				price: parseFloat(productForm.price),
				imageUrl: productForm.imageUrl,
				description: productForm.description,
				artisanId: artisanId || 'unknown-artisan',
				status: 'pending' // mark as pending review
			};

			// update local state view (show in artisan's list as pending)
			setProducts(prev => [newProduct, ...prev]);

			// store in pendingProducts for consultant review
			const existingPending = JSON.parse(localStorage.getItem('pendingProducts') || '[]');
			localStorage.setItem('pendingProducts', JSON.stringify([newProduct, ...existingPending]));

			// Reset form
			setProductForm({
				name: '',
				price: '',
				imageUrl: '',
				description: ''
			});

			alert('Product submitted for review by consultant.');
		} else {
			alert('Please fill all fields');
		}
	};

	// load existing products — combine approved (adminProducts) and pending (pendingProducts)
	const loadExistingProducts = () => {
		const adminProducts = JSON.parse(localStorage.getItem('adminProducts') || '[]');
		const pendingProducts = JSON.parse(localStorage.getItem('pendingProducts') || '[]');

		// filter to only those that belong to this artisan
		const approvedMine = (Array.isArray(adminProducts) ? adminProducts : []).filter(p => String(p.artisanId) === String(artisanId)).map(p => ({ ...p, status: 'approved' }));
		const pendingMine = (Array.isArray(pendingProducts) ? pendingProducts : []).filter(p => String(p.artisanId) === String(artisanId)).map(p => ({ ...p, status: 'pending' }));

		// set combined list (approved first)
		setProducts([...approvedMine, ...pendingMine]);
		setShowProductList(true);
	};

	// edit product - track source so update knows where to write
	const handleEditProduct = (product) => {
		setProductForm({
			name: product.name,
			price: product.price.toString(),
			imageUrl: product.imageUrl,
			description: product.description
		});
		setEditingProduct(product.id);
		setEditingSource(product.status === 'pending' ? 'pending' : 'approved');
		setShowProductList(false);
	};

	// update product - write back to the correct storage key
	const handleUpdateProduct = () => {
		if (productForm.name && productForm.price && productForm.imageUrl && productForm.description) {
			const updated = {
				id: editingProduct,
				name: productForm.name,
				price: parseFloat(productForm.price),
				imageUrl: productForm.imageUrl,
				description: productForm.description,
				artisanId: artisanId || 'unknown-artisan',
				status: editingSource === 'pending' ? 'pending' : 'approved'
			};

			// Update in-memory list
			setProducts(prev => prev.map(p => (p.id === editingProduct ? updated : p)));

			// Persist to correct storage bucket
			if (editingSource === 'pending') {
				const pending = JSON.parse(localStorage.getItem('pendingProducts') || '[]');
				const next = (Array.isArray(pending) ? pending : []).map(p => (String(p.id) === String(editingProduct) ? { ...p, ...updated } : p));
				localStorage.setItem('pendingProducts', JSON.stringify(next));
			} else {
				const admin = JSON.parse(localStorage.getItem('adminProducts') || '[]');
				const next = (Array.isArray(admin) ? admin : []).map(p => (String(p.id) === String(editingProduct) ? { ...p, ...updated } : p));
				localStorage.setItem('adminProducts', JSON.stringify(next));
			}

			// Reset form and editing state
			setProductForm({ name: '', price: '', imageUrl: '', description: '' });
			setEditingProduct(null);
			setEditingSource(null);

			alert('Product updated successfully!');
		} else {
			alert('Please fill all fields');
		}
	};

	// remove product -> remove from pendingProducts or adminProducts depending on status
	const removeProduct = (id) => {
		const prod = products.find(p => String(p.id) === String(id));
		if (!prod) return;

		if (prod.status === 'pending') {
			const pending = JSON.parse(localStorage.getItem('pendingProducts') || '[]');
			const next = (Array.isArray(pending) ? pending : []).filter(p => String(p.id) !== String(id));
			localStorage.setItem('pendingProducts', JSON.stringify(next));
		} else {
			const admin = JSON.parse(localStorage.getItem('adminProducts') || '[]');
			const next = (Array.isArray(admin) ? admin : []).filter(p => String(p.id) !== String(id));
			localStorage.setItem('adminProducts', JSON.stringify(next));
		}

		setProducts(prev => prev.filter(p => String(p.id) !== String(id)));
		alert('Product removed successfully!');
	};

	const confirmDelete = (id, name) => {
		if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
			removeProduct(id);
		}
	};

	const filteredProducts = products.filter(product => 
		product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
		product.id.toString().includes(searchTerm)
	);

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

	// add logout handler
	const handleLogout = () => {
		localStorage.removeItem('user');
		localStorage.removeItem('cart');
		window.location.href = '/';
	};

	// start camera (uses cameraFacing state unless override provided)
	async function startCamera(overrideFacing) {
		const facingMode = overrideFacing || cameraFacing || 'environment';
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			alert('Camera not supported on this device/browser.');
			return;
		}
		try {
			// prefer exact constraint where supported
			const constraints = {
				video: { facingMode: { ideal: facingMode } },
				audio: false
			};
			// stop existing stream if any
			if (streamRef.current) {
				streamRef.current.getTracks().forEach(t => t.stop());
				streamRef.current = null;
			}
			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			streamRef.current = stream;
			if (videoRef.current) {
				const v = videoRef.current;
				// attach stream
				v.srcObject = stream;
				v.muted = true;
				v.playsInline = true;
				// wait for metadata and for play to start
				await new Promise((resolve) => {
					const onMeta = () => {
						if (v.videoWidth && v.videoHeight) {
							v.removeEventListener('loadedmetadata', onMeta);
							resolve();
						}
					};
					v.addEventListener('loadedmetadata', onMeta);
					// fallback in case event doesn't fire
					setTimeout(resolve, 1200);
				});
				// try to play the video; some browsers require muted for autoplay
				try { await v.play(); } catch (e) { /* ignore */ }
			}
			setShowCamera(true);
		} catch (err) {
			console.error('Camera start failed', err);
			alert('Unable to access camera.');
		}
	}

	// toggle camera facing (restart stream if currently open)
	async function toggleFacing() {
		const next = cameraFacing === 'environment' ? 'user' : 'environment';
		setCameraFacing(next);
		// if camera open, restart with new facing
		if (streamRef.current || showCamera) {
			// stop current
			try {
				if (streamRef.current) {
					streamRef.current.getTracks().forEach(t => t.stop());
					streamRef.current = null;
				}
				if (videoRef.current) videoRef.current.srcObject = null;
			} catch (e) {}
			// start new with override to ensure immediate change
			await startCamera(next);
		}
	}

	// stop camera
	function stopCamera() {
		try {
			if (streamRef.current) {
				streamRef.current.getTracks().forEach(t => t.stop());
				streamRef.current = null;
			}
			// clear srcObject to release camera in some browsers
			if (videoRef.current) {
				videoRef.current.srcObject = null;
			}
		} catch (e) {
			// ignore
		}
		setShowCamera(false);
	}

	// capture photo and set imageUrl to dataURL
	async function capturePhoto() {
		const video = videoRef.current;
		const canvas = canvasRef.current;
		if (!video || !canvas) return;

		// Ensure video has current data/frame
		if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
			// wait up to 1s for data
			await new Promise(resolve => {
				let resolved = false;
				const timeout = setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 1000);
				const onLoaded = () => {
					if (!resolved && video.videoWidth && video.videoHeight) {
						resolved = true;
						clearTimeout(timeout);
						video.removeEventListener('loadeddata', onLoaded);
						resolve();
					}
				};
				video.addEventListener('loadeddata', onLoaded);
			});
		}

		// small delay to allow frame to stabilize (helps avoid dark/blank frames)
		await new Promise(r => setTimeout(r, 200));

		const w = video.videoWidth || 640;
		const h = video.videoHeight || 480;
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');

		try {
			// draw current frame
			ctx.drawImage(video, 0, 0, w, h);

			// create data URL and set as imageUrl
			const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
			if (dataUrl && dataUrl.startsWith('data:image/')) {
				setProductForm(prev => ({ ...prev, imageUrl: dataUrl }));
			} else {
				throw new Error('Invalid capture data');
			}
		} catch (err) {
			console.error('capturePhoto failed', err);
			alert('Capture failed. Please try again.');
		} finally {
			// stop camera after capture and release stream
			try {
				if (streamRef.current) {
					streamRef.current.getTracks().forEach(t => t.stop());
					streamRef.current = null;
				}
				if (videoRef.current) videoRef.current.srcObject = null;
			} catch (e) {}
			setShowCamera(false);
		}
	}

	// cleanup on unmount
	useEffect(() => {
		return () => {
			try {
				if (streamRef.current) {
					streamRef.current.getTracks().forEach(t => t.stop());
				}
			} catch (e) {}
		};
	}, []);

	function loadProductFeedbacks() {
		try {
			const f = JSON.parse(localStorage.getItem('productFeedbacks') || '[]');
			setProductFeedbacks(Array.isArray(f) ? f : []);
		} catch (e) {
			setProductFeedbacks([]);
		}
	}

	useEffect(() => {
		loadProductFeedbacks();
	}, []);

	return (
		<div className="admin-container">
			<header className="admin-header">
				<h1>Artisan Panel - Product Management</h1>
				<nav>
					<button onClick={() => setShowProductList(false)}>Add Product</button>
					<button onClick={loadExistingProducts}>View Products</button>
					{/* Logout button */}
					<button
						onClick={handleLogout}
						style={{ marginLeft: '12px', padding: '8px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
					>
						Logout
					</button>
				</nav>
			</header>

			{/* Show all toggle and refresh for orders */}
			<div className="controls" style={{ paddingLeft: 0 }}>
				<label>
					<input type="checkbox" checked={showAllOrders} onChange={(e) => setShowAllOrders(e.target.checked)} />
					<span>Show all orders</span>
				</label>
				<button onClick={loadOrders}>Refresh Orders</button>
			</div>

			{!showProductList ? (
				<div className="add-product-section">
					<h2 style={{ color: 'black' }}>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
					<div className="product-form">
						<input
							type="text"
							name="name"
							placeholder="Product Name"
							value={productForm.name}
							onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
						/>
						<input
							type="number"
							name="price"
							placeholder="Price (₹)"
							value={productForm.price}
							onChange={(e) => setProductForm(prev => ({ ...prev, price: e.target.value }))}
							step="0.01"
						/>
						<input
							type="url"
							name="imageUrl"
							placeholder="Image URL"
							value={productForm.imageUrl}
							onChange={(e) => setProductForm(prev => ({ ...prev, imageUrl: e.target.value }))}
						/>

						{/* camera / file fallback */}
						<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
							<button
								type="button"
								onClick={() => startCamera()}
								style={{ padding: '6px 10px', borderRadius: 6, background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
							>
								📷 Take Photo
							</button>

							<button
								type="button"
								onClick={toggleFacing}
								style={{ padding: '6px 10px', borderRadius: 6, background: '#6c757d', color: 'white', border: 'none', cursor: 'pointer' }}
							>
								↺ Flip Camera
							</button>

							{/* mobile file input fallback (opens camera on many phones) */}
							<input
								type="file"
								accept="image/*"
								capture="environment"
								onChange={(e) => {
									const f = e.target.files && e.target.files[0];
									if (!f) return;
									const reader = new FileReader();
									reader.onload = () => {
										setProductForm(prev => ({ ...prev, imageUrl: reader.result }));
									};
									reader.readAsDataURL(f);
								}}
								style={{ border: 'none' }}
							/>
						</div>

						{/* Camera modal */}
						{showCamera && (
							<div className="camera-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
								<div style={{ background: 'white', padding: 12, borderRadius: 8, maxWidth: 720, width: '95%' }}>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
										<strong>Camera</strong>
										<div>
											<button onClick={capturePhoto} style={{ marginRight: 8, padding: '6px 10px' }}>Capture</button>
											<button onClick={stopCamera} style={{ padding: '6px 10px' }}>Close</button>
										</div>
									</div>
									<video
										ref={videoRef}
										style={{ width: '100%', maxHeight: 480, background: '#000' }}
										playsInline
										muted
										autoPlay
									/>
									<canvas ref={canvasRef} style={{ display: 'none' }} />
								</div>
							</div>
						)}

						{/* Description + Mic UI */}
						<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
							<label style={{color: 'black', fontWeight: 600 }}>Product Description</label>
							<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
								<textarea
									name="description"
									placeholder="Product Description"
									value={productForm.description}
									onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
									rows="4"
									style={{ flex: 1 }}
								/>
								<div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
									<select
										value={selectedLang}
										onChange={(e) => setSelectedLang(e.target.value)}
										title="Select spoken language"
										style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #ccc', background: 'white' }}
									>
										<option value="auto">Auto (detect)</option>
										<option value="en">English</option>
										<option value="te">Telugu</option>
										<option value="hi">Hindi</option>
										<option value="ta">Tamil</option>
										<option value="ml">Malayalam</option>
										<option value="kn">Kannada</option>
										<option value="pa">Punjabi</option>
										<option value="mr">Marathi</option>
										<option value="bn">Bengali</option>
									</select>
									<button
										type="button"
										onClick={toggleListening}
										title={listening ? 'Stop listening' : 'Speak description (Telugu/Hindi)'}
										style={{
											padding: '8px 12px',
											backgroundColor: listening ? '#ff6b35' : '#007bff',
											color: 'white',
											border: 'none',
											borderRadius: 6,
											cursor: 'pointer'
										}}
									>
										{listening ? '● Listening' : '🎤 Speak'}
									</button>
								</div>
							</div>
							{transcript && (
								<div style={{ fontStyle: 'italic', color: '#555' }}>Heard: {transcript}</div>
							)}
						</div>

						{editingProduct ? (
							<div className="edit-buttons">
								<button onClick={handleUpdateProduct} className="update-btn">Update Product</button>
								<button onClick={() => { setProductForm({ name: '', price: '', imageUrl: '', description: '' }); setEditingProduct(null); setEditingSource(null); }} className="cancel-btn">Cancel</button>
							</div>
						) : (
							<button onClick={handleAddProduct} className="add-btn">Add Product</button>
						)}
					</div>

					{productForm.imageUrl && (
						<div className="preview">
							<h3>Preview:</h3>
							<img src={productForm.imageUrl} alt="Preview" className="preview-image" />
						</div>
					)}
				</div>
			) : (
				<div className="product-list-section">
					<h2 style={{ color: 'black' }}>Existing Products ({products.length})</h2>

					<div className="search-bar">
						<input
							type="text"
							placeholder="Search by product name or ID..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="search-input"
						/>
					</div>

					<div className="products-grid">
						{products.filter(product => product.name.toLowerCase().includes(searchTerm.toLowerCase()) || product.id.toString().includes(searchTerm)).map(product => (
							<div key={product.id} className="admin-product-card">
								<div className="product-id">ID: {product.id} {product.status === 'pending' ? '(Pending)' : '(Approved)'}</div>
								<img src={product.imageUrl} alt={product.name} />
								<h3>{product.name}</h3>
								<p>Price: ₹{(product.price || 0).toFixed(2)}</p>
								<p className="description">{product.description}</p>
								<div className="product-actions">
									<button onClick={() => handleEditProduct(product)} className="edit-btn">Edit</button>
									<button onClick={() => confirmDelete(product.id, product.name)} className="remove-btn">Delete</button>
									<button onClick={() => setShowFeedbackListFor(product)} className="edit-btn" style={{ marginLeft: 8 }}>
										Feedback ({productFeedbacks.filter(f => String(f.productId) === String(product.id)).length})
									</button>
								</div>
							</div>
						))}
					</div>
					{products.filter(product => product.name.toLowerCase().includes(searchTerm.toLowerCase()) || product.id.toString().includes(searchTerm)).length === 0 && searchTerm && <p>No products found matching "{searchTerm}".</p>}
					{products.length === 0 && <p>No products added yet.</p>}
				</div>
			)}

			{/* Orders area (enhanced look) */}
			<div className="orders-area" style={{ padding: 12 }}>
				{/* Banner like artisan login */}
				<div style={{ marginBottom: 12 }}>
					<h1 style={{ margin: 0, fontSize: '1.4rem', color: 'black' }}>Artisan Panel</h1>
					<div style={{ color: 'black' }}>Logged in as: {artisanId || 'Not logged in'}</div>
				</div>

				<div style={{ marginBottom: 12 }}>
					<strong style={{ color: 'black' }}>Showing orders:</strong> <span style={{ color: 'black' }}>{orders.length}</span> — <strong style={{ color: 'black' }}>Total Revenue:</strong> <span style={{ color: 'black' }}>₹{totalRevenue.toFixed(2)}</span>
				</div>

				{orders.length === 0 ? (
					<p className="no-orders">No orders for you yet.</p>
				) : (
					<ul className="orders-list">
						{orders.map(o => (
							<li key={o.id} className="order-card">
								<div className="order-card-top">
									<div className="order-left">
										<div className="order-id">#{o.id}</div>
										<div className="order-date">{new Date(o.date).toLocaleString()}</div>
									</div>

									<div className="order-right">
										<span className={`status-badge ${o.status || 'placed'}`}>{(o.status || 'placed').toUpperCase()}</span>
									</div>
								</div>

								<div className="order-items-compact">
									{Array.isArray(o.items) && o.items.map((it, i) => {
										const imgSrc = it.image || it.imageUrl || it.img || it.thumbnail || '';
										const price = (parseFloat(it.price || it.amount || 0) || 0).toFixed(2);
										const qty = it.quantity || 1;
										return (
											<div className="order-item" key={i}>
												{imgSrc ? (
													<img src={imgSrc} alt={it.name || it.title || `item-${i}`} className="order-item-thumb" loading="lazy" onError={(e)=>{e.currentTarget.style.display='none'}} />
												) : (
													<div className="order-item-thumb placeholder" />
												)}
												<div className="order-item-meta">
													<div className="order-item-name">{it.name || it.title}</div>
													<div className="order-item-sub">qty: {qty} • ₹{price}</div>
												</div>
											</div>
										);
									})}
								</div>

								<div className="order-card-bottom">
									<div className="order-customer">Customer: <strong>{o.customerId || 'unknown'}</strong></div>
									<div className="order-total">Total: <strong>₹{orderTotal(o).toFixed(2)}</strong></div>
								</div>

								<div className="order-actions">
									{(() => {
										const canEdit = (
											(o.artisanId && String(o.artisanId) === String(artisanId)) ||
											(Array.isArray(o.items) && o.items.some(it => itemMatchesArtisan(it, artisanId)))
										);
										return (
											<>
												<button
													className="action-btn processing"
													onClick={() => updateOrderStatus(o.id, 'processing')}
													disabled={!canEdit || o.status === 'processing'}
												>Mark Processing</button>

												<button
													className="action-btn delivered"
													onClick={() => updateOrderStatus(o.id, 'delivered')}
													disabled={!canEdit || o.status === 'delivered'}
												>Mark Delivered</button>

												{!canEdit && <div className="note">You cannot change status of unrelated orders.</div>}
											</>
										);
									})()}
								</div>
							</li>
						))}
					</ul>
				)}
			</div>

			{showFeedbackListFor && (
				<div className="camera-overlay" style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.6)', zIndex:2200 }}>
					<div style={{ width: '90%', maxWidth:720, background:'#fff', padding:12, borderRadius:8 }}>
						<h3>Feedback for: {showFeedbackListFor.name}</h3>
						<ul style={{ maxHeight: 320, overflow: 'auto', padding:0 }}>
							{productFeedbacks.filter(f => String(f.productId) === String(showFeedbackListFor.id)).map(f => (
								<li key={f.id} style={{ padding:8, borderBottom:'1px solid #eee' }}>
									<div style={{ fontWeight:700 }}>{f.authorName} <span style={{ fontWeight:400, marginLeft:8 }}>{new Date(f.date).toLocaleString()}</span></div>
									<div style={{ marginTop:6 }}>{f.text}</div>
								</li>
							))}
							{productFeedbacks.filter(f => String(f.productId) === String(showFeedbackListFor.id)).length === 0 && <li style={{ padding:8 }}>No feedback yet.</li>}
						</ul>
						<div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
							<button onClick={() => setShowFeedbackListFor(null)} style={{ padding:'8px 10px' }}>Close</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default Artisan;