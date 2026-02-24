import React, { useState, useEffect } from 'react';
import './customer.css';
import { StrictMode } from 'react';

function Customer() {
    const [cart, setCart] = useState([]);
    const [showCart, setShowCart] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [adminProducts, setAdminProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Load admin products from localStorage
    React.useEffect(() => {
        const products = JSON.parse(localStorage.getItem('adminProducts') || '[]');
        setAdminProducts(products);
    }, []);

    useEffect(() => {
		// try to load cart from localStorage; adapt if your app uses context/props instead
		const raw = localStorage.getItem('cart');
		if (raw) {
			try {
				setCart(JSON.parse(raw));
			} catch (e) {
				setCart([]);
			}
		}
	}, []);

    const handleAddToCart = (productName, price, imageUrl) => {
        const existingItem = cart.find(item => item.name === productName);
        
        if (existingItem) {
            setCart(cart.map(item => 
                item.name === productName 
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, { name: productName, price: price, quantity: 1, image: imageUrl }]);
        }
        
        alert(`${productName} added to cart!`);
    };

    const removeFromCart = (productName) => {
        setCart(cart.filter(item => item.name !== productName));
    };

    const getTotalPrice = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2);
    };

    const handleShowDetails = (productName, imageUrl, price, description, productId) => {
        setSelectedProduct({ name: productName, image: imageUrl, price: price, description: description, id: productId });
        setDetailLang('en');
        setTranslatedDescription(''); // will translate automatically via effect
        setShowDetails(true);
    };

    // All products combined (only admin products now)
    const allProducts = [...adminProducts];

    const filteredProducts = allProducts.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.id.toString().includes(searchTerm)
    );

    function saveCart(newCart) {
		setCart(newCart);
		localStorage.setItem('cart', JSON.stringify(newCart));
	}

	function placeOrder() {
		if (!cart || cart.length === 0) {
			alert('Cart is empty');
			return;
		}

		// get logged-in customer id if present
		let customerId = null;
		try {
			const user = JSON.parse(localStorage.getItem('user') || 'null');
			if (user && user.id) customerId = user.id;
		} catch (e) {
			customerId = null;
		}

		// group items by artisanId (fallback to addedBy)
		const groups = {};
		cart.forEach(item => {
			const artisanId = item.artisanId || item.addedBy || 'unknown-artisan';
			if (!groups[artisanId]) groups[artisanId] = [];
			groups[artisanId].push(item);
		});

		// load existing orders
		let orders = [];
		try {
			orders = JSON.parse(localStorage.getItem('orders') || '[]');
		} catch (e) {
			orders = [];
		}

		// create one order per artisan
		const now = new Date().toISOString();
		Object.keys(groups).forEach(artisanId => {
			const newOrder = {
				id: `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
				artisanId,
				customerId,
				items: groups[artisanId],
				date: now,
				status: 'placed'
			};
			orders.push(newOrder);
		});

		localStorage.setItem('orders', JSON.stringify(orders));

		// clear cart
		saveCart([]);

		alert('Order placed');
	}

    // smooth-scroll to cart section and ensure overlay is closed
    function scrollToCart(e) {
        if (e && e.preventDefault) e.preventDefault();
        setShowCart(false);
        const el = document.getElementById('cart');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
    }

    // add logout handler
    const handleLogout = () => {
        // remove any stored user info and cart (optional)
        localStorage.removeItem('user');
        localStorage.removeItem('cart');
        // navigate back to the app root so Login.jsx appears
        window.location.href = '/';
    };

    // new state: language selected for details modal and translated text
	const [detailLang, setDetailLang] = useState('en'); // default show English
	const [translatedDescription, setTranslatedDescription] = useState('');

	// translate helper: try LibreTranslate then Google fallback
	async function translateText(text, target) {
		if (!text) return '';
		const LIBRE_URL = 'https://libretranslate.de/translate';
		const googleFallback = async (txt) => {
			const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(target) + '&dt=t&q=' + encodeURIComponent(txt);
			const r = await fetch(url);
			if (!r.ok) throw new Error('Google translate failed');
			const json = await r.json();
			if (Array.isArray(json)) return json[0].map(part => part[0]).join('');
			throw new Error('Unexpected Google response');
		};

		// try LibreTranslate
		try {
			const res = await fetch(LIBRE_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					q: text,
					source: 'auto',
					target: target,
					format: 'text'
				})
			});
			if (res.ok) {
				const data = await res.json();
				const translated = data.translatedText || data.translated || '';
				if (translated) return translated;
			}
		} catch (err) {
			// fallthrough
		}

		// fallback to Google
		try {
			const g = await googleFallback(text);
			if (g) return g;
		} catch (err) {
			// final fallback
		}

		// if all fail, return original text
		return text;
	}

	// auto-translate when details open or when target language changes
	useEffect(() => {
		let mounted = true;
		if (!showDetails || !selectedProduct) return;
		(async () => {
			const orig = selectedProduct.description || '';
			// if user requests 'original', show stored text
			if (detailLang === 'original') {
				if (mounted) setTranslatedDescription(orig);
				return;
			}
			// if target equals 'en' and original is likely already english, still call translate to ensure consistency
			const translated = await translateText(orig, detailLang);
			if (mounted) setTranslatedDescription(translated);
		})();
		return () => { mounted = false; };
	}, [showDetails, selectedProduct, detailLang]);

	// new: product feedbacks
	const [productFeedbacks, setProductFeedbacks] = useState([]);
	const [showFeedbackModal, setShowFeedbackModal] = useState(false);
	const [feedbackProduct, setFeedbackProduct] = useState(null);
	const [feedbackText, setFeedbackText] = useState('');

	// load feedbacks
	function loadFeedbacks() {
		try {
			const f = JSON.parse(localStorage.getItem('productFeedbacks') || '[]');
			setProductFeedbacks(Array.isArray(f) ? f : []);
		} catch (e) {
			setProductFeedbacks([]);
		}
	}

	// save a new feedback
	function saveFeedback(productId, text) {
		if (!text || !text.trim()) {
			alert('Please write feedback before submitting.');
			return;
		}
		const user = JSON.parse(localStorage.getItem('user') || 'null');
		const authorId = user && user.id ? user.id : 'guest';
		const authorName = (user && user.username) || 'Guest';
		const entry = {
			id: `fb_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
			productId,
			authorId,
			authorName,
			text: text.trim(),
			date: new Date().toISOString()
		};
		const existing = JSON.parse(localStorage.getItem('productFeedbacks') || '[]');
		localStorage.setItem('productFeedbacks', JSON.stringify([entry, ...(Array.isArray(existing)?existing:[])]));
		loadFeedbacks();
		setFeedbackText('');
		setShowFeedbackModal(false);
		alert('Feedback submitted. Thank you!');
	}

	// open feedback modal for a product
	function openFeedbackModal(product) {
		setFeedbackProduct(product);
		setFeedbackText('');
		setShowFeedbackModal(true);
	}

	useEffect(() => {
		// also load feedbacks
		loadFeedbacks();
	}, []);

    return (
        <div>
            <header>
                <h1 style={{ color: 'white' }}>THE CRAFTORA</h1>
                <nav>
                    <a href="#home">Home</a>
                    <a href="#products">Products</a>
                    <a href="#about">About Us</a>
                    <a href="#contact">Contact</a>
                    <a href="#cart" onClick={scrollToCart}>Cart ({cart.length})</a>
                    <button 
                        onClick={() => setShowCart(!showCart)}
                        style={{float: 'right', marginLeft: '20px', padding: '10px 20px', background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s ease', boxShadow: '0 4px 10px rgba(243, 156, 18, 0.3)'}}
                        onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 20px rgba(243, 156, 18, 0.4)'; }}
                        onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 10px rgba(243, 156, 18, 0.3)'; }}
                    >
                        Cart ({cart.length})
                    </button>

                    {/* Logout button */}
                    <button
                        onClick={handleLogout}
                        style={{ float: 'right', marginLeft: '10px', padding: '10px 20px', background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s ease', boxShadow: '0 4px 10px rgba(231, 76, 60, 0.3)' }}
                        onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 20px rgba(231, 76, 60, 0.4)'; }}
                        onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 10px rgba(231, 76, 60, 0.3)'; }}
                    >
                        Logout
                    </button>
                </nav>
            </header>

            {showCart && (
                <div className="cart-overlay">
                    <div className="cart-modal">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ color: '#ecf0f1', margin: 0 }}>Shopping Cart</h2>
                            <button className="button" onClick={placeOrder} disabled={!cart || cart.length === 0} style={{ margin: 0 }}>
                                Place Order
                            </button>
                        </div>
                        {cart.length === 0 ? (
                            <p style={{ color: '#95a5a6', textAlign: 'center', padding: '20px', fontStyle: 'italic' }}>Your cart is empty</p>
                        ) : (
                            <>
                                {cart.map((item, index) => (
                                    <div key={index} className="cart-item">
                                        <img src={item.image} alt={item.name} className="cart-item-image" />
                                        <div className="cart-item-details">
                                            <span className="cart-item-name">{item.name}</span>
                                            <span style={{ color: '#bdc3c7' }}>Qty: {item.quantity}</span>
                                            <span style={{ color: '#f39c12', fontWeight: '700' }}>₹{(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                        <button className="button" style={{ margin: 0 }} onClick={() => removeFromCart(item.name)}>Remove</button>
                                    </div>
                                ))}
                                <div className="cart-total">
                                    <strong>Total: ₹{getTotalPrice()}</strong>
                                </div>
                            </>
                        )}
                        <button className="button" style={{ marginTop: '15px', width: '100%' }} onClick={() => setShowCart(false)}>Close</button>
                    </div>
                </div>
            )}

            {showDetails && (
                <div className="cart-overlay">
                    <div className="cart-modal">
                        <h2 style={{ color: '#ecf0f1' }}>Product Details</h2>
                        {selectedProduct && (
                            <div className="product-details">
                                <img src={selectedProduct.image} alt={selectedProduct.name} style={{width: '220px', height: '220px', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 8px 20px rgba(243, 156, 18, 0.3)', border: '3px solid #f39c12'}} />
                                <h3 style={{ color: '#ecf0f1' }}>{selectedProduct.name}</h3>
                                <p style={{ color: '#bdc3c7' }}>Product ID: {selectedProduct.id}</p>
                                <p style={{ color: '#f39c12', fontSize: '1.3em', fontWeight: '700' }}>₹{selectedProduct.price.toFixed(2)}</p>

                                {/* language selector for description */}
								<div style={{ marginTop: 15, background: 'rgba(255, 255, 255, 0.05)', padding: 15, borderRadius: 10 }}>
									<label style={{ color: '#ecf0f1', marginRight: 12, fontWeight: '600' }}>Show description in:</label>
									<select
										value={detailLang}
										onChange={(e) => setDetailLang(e.target.value)}
										style={{ padding: '8px 12px', borderRadius: 8, border: '2px solid #f39c12', background: '#ecf0f1', color: '#2c3e50', fontWeight: '600', cursor: 'pointer' }}
									>
										<option value="original">Original</option>
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
								</div>

								{/* translated description display */}
								<div style={{ marginTop: 15, color: '#bdc3c7', whiteSpace: 'pre-wrap', background: 'rgba(255, 255, 255, 0.05)', padding: 15, borderRadius: 10, maxHeight: '150px', overflowY: 'auto', textAlign: 'left' }}>
									{translatedDescription || selectedProduct.description || 'No description'}
								</div>

								{/* show existing feedbacks for this product */}
								{selectedProduct && (
									<div style={{ marginTop: 15, borderTop: '2px solid #f39c12', paddingTop: 15 }}>
										<h4 style={{ color: '#ecf0f1', marginBottom: 12 }}>Customer Feedback</h4>
										{(productFeedbacks.filter(f => String(f.productId) === String(selectedProduct.id))).length === 0 ? (
											<p style={{ color: '#95a5a6', fontStyle: 'italic' }}>No feedback yet.</p>
										) : (
											<ul style={{ maxHeight: 220, overflow: 'auto', paddingLeft: 0, margin: 0, listStyle: 'none' }}>
												{productFeedbacks.filter(f => String(f.productId) === String(selectedProduct.id)).map(f => (
													<li key={f.id} style={{ marginBottom: 10, color: '#ecf0f1', background: 'rgba(243, 156, 18, 0.1)', padding: 12, borderRadius: 8, borderLeft: '4px solid #f39c12' }}>
														<div style={{ fontWeight: 700, color: '#f39c12' }}>{f.authorName} <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8, color: '#95a5a6' }}>{new Date(f.date).toLocaleString()}</span></div>
														<div style={{ marginTop: 8, color: '#bdc3c7' }}>{f.text}</div>
													</li>
												))}
											</ul>
										)}
										{/* quick add feedback from details */}
										<button className="button" style={{ marginTop: 12 }} onClick={() => openFeedbackModal(selectedProduct)}>Write Feedback</button>
									</div>
								)}
                            </div>
                        )}
                        <button className="button" style={{ marginTop: 20, width: '100%' }} onClick={() => setShowDetails(false)}>Close</button>
                    </div>
                </div>
            )}

            {showFeedbackModal && feedbackProduct && (
				<div className="cart-overlay">
					<div className="cart-modal">
						<h2 style={{ color: '#ecf0f1' }}>Feedback — {feedbackProduct.name}</h2>
						<textarea value={feedbackText} onChange={(e)=>setFeedbackText(e.target.value)} rows={6} placeholder="Share your experience with this product..." style={{ width: '100%', padding: 12, borderRadius: 8, border: '2px solid #f39c12', fontFamily: 'inherit', fontSize: 14, background: '#f5f5f5', color: '#2c3e50', boxSizing: 'border-box' }} />
						<div style={{ display: 'flex', gap: 12, marginTop: 15 }}>
							<button className="button" style={{ flex: 1 }} onClick={() => saveFeedback(feedbackProduct.id, feedbackText)}>Submit</button>
							<button className="button" style={{ flex: 1, background: 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)', boxShadow: '0 4px 10px rgba(149, 165, 166, 0.3)' }} onClick={() => setShowFeedbackModal(false)}>Cancel</button>
						</div>
					</div>
				</div>
			)}

            <div className="marquee">
                <marquee behavior="scroll" direction="left">Welcome to our site. India's premier platform for artisan products. Check out our amazing products!</marquee>
            </div>
            <div>
            <section id="home">
                <h2 style={{ color: '#2c3e50' }}>Craftora: India's Premier Artisan Marketplace</h2>
                <p style={{ color: '#555', fontSize: '1.05em' }}>Discover a carefully curated collection of authentic handcrafted products. Support artisans and preserve traditional art forms while enjoying exceptional quality and craftsmanship.</p>
            </section>
            </div>
            <section id="products">
                <h2 style={{ color: '#2c3e50' }}>Featured Products</h2>
                
                <div className="search-bar">
                    <input
                        type="text"
                        placeholder="Search products by name or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                {searchTerm ? (
                    <div className="container">
                        {filteredProducts.map(product => (
                            <div key={product.id} className="product">
                                <img src={product.imageUrl} alt={product.name} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, display: 'block', margin: '0 auto 12px' }} />
                                <h3>{product.name}</h3>
                                <p style={{ color: '#f39c12', fontSize: '1.1em', fontWeight: '600' }}>₹{product.price.toFixed(2)}</p>
                                <button className="button" onClick={() => handleShowDetails(product.name, product.imageUrl, product.price, product.description, product.id)}>Details</button>
                                <button className="button" onClick={() => handleAddToCart(product.name, product.price, product.imageUrl)}>Add to Cart</button>
                                {/* Add Feedback button */}
                                <button className="button" onClick={() => openFeedbackModal(product)}>Feedback</button>
                            </div>
                        ))}
                        {filteredProducts.length === 0 && <p style={{textAlign: 'center', color: '#95a5a6', fontStyle: 'italic', padding: '30px'}}>No products found matching "{searchTerm}".</p>}
                    </div>
                ) : (
                    <>
                        {/* Admin Added Products */}
                        {adminProducts.length > 0 ? (
                            <div className="container">
                                {adminProducts.map(product => (
                                    <div key={product.id} className="product">
                                        <img src={product.imageUrl} alt={product.name} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, display: 'block', margin: '0 auto 12px' }} />
                                        <h3>{product.name}</h3>
                                        <p style={{ color: '#f39c12', fontSize: '1.1em', fontWeight: '600' }}>₹{product.price.toFixed(2)}</p>
                                        <button className="button" onClick={() => handleShowDetails(product.name, product.imageUrl, product.price, product.description, product.id)}>Details</button>
                                        <button className="button" onClick={() => handleAddToCart(product.name, product.price, product.imageUrl)}>Add to Cart</button>
                                        {/* Add Feedback button */}
                                        <button className="button" onClick={() => openFeedbackModal(product)}>Feedback</button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{textAlign: 'center', color: '#95a5a6', fontSize: '18px', marginTop: '40px', fontStyle: 'italic'}}>No products available. Admin can add products to display here.</p>
                        )}
                    </>
                )}

            </section>

            <section id="about">
                <h2 style={{ color: '#2c3e50' }}>About Us</h2>
                <p style={{ color: '#555', fontSize: '1.05em', lineHeight: '1.8' }}>We are a leading online marketplace dedicated to supporting artisans and promoting traditional crafts. Our mission is to connect skilled craftspeople with customers who appreciate authentic, handcrafted products. By shopping with us, you help preserve cultural heritage and support local communities. Each product tells a story of tradition, passion, and exceptional craftsmanship.</p>
            </section>

            <section id="contact">
                <h2 style={{ color: '#2c3e50' }}>Contact Us</h2>
                <p style={{ color: '#555' }}>If you have any questions or need assistance, feel free to reach out to us:</p>
                <div style={{ background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)', padding: '20px', borderRadius: '10px', marginTop: '20px', color: 'white' }}>
                    <p style={{ color: 'white', margin: '8px 0', fontSize: '1.05em' }}><strong>Email:</strong> manikantasaikearthi@gmail.com</p>
                    <p style={{ color: 'white', margin: '8px 0', fontSize: '1.05em' }}><strong>Phone:</strong> 9032646737</p>
                </div>
            </section>

            <section id="cart">
                <h2>Your Shopping Cart</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <p style={{ color: '#555', margin: 0 }}>Total Items: <strong style={{ color: '#f39c12' }}>{cart.length}</strong></p>
                    <button className="button" onClick={placeOrder} disabled={!cart || cart.length === 0}>
                        Place Order Now
                    </button>
                </div>

                {(!cart || cart.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px', background: '#f8f9fa', borderRadius: '10px' }}>
                        <p style={{ color: '#95a5a6', fontSize: '1.1em' }}>Your cart is currently empty. Explore our featured products above!</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {cart.map((item, idx) => (
                            <div key={idx} style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #ecf0f1 100%)', padding: '15px', borderRadius: '10px', borderLeft: '4px solid #f39c12', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ color: '#2c3e50', fontWeight: '600', margin: '0 0 5px 0' }}>{item.name || item.title}</p>
                                    <p style={{ color: '#7f8c8d', margin: 0 }}>Quantity: <strong>{item.quantity || 1}</strong> | Price: <strong style={{ color: '#f39c12' }}>₹{(item.price * (item.quantity || 1)).toFixed(2)}</strong></p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <footer>
                <p>&copy; @2025 The Craftora. All rights reserved.</p>
            </footer>
        </div>
    );
}

export default Customer;