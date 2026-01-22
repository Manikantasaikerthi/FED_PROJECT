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
                        style={{float: 'right', marginLeft: '20px', padding: '8px 16px', color: 'black', border: 'none', borderRadius: '5px', cursor: 'pointer'}}
                    >
                        Cart ({cart.length})
                    </button>

                    {/* Logout button */}
                    <button
                        onClick={handleLogout}
                        style={{ float: 'right', marginLeft: '10px', padding: '8px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                    >
                        Logout
                    </button>
                </nav>
            </header>

            {showCart && (
                <div className="cart-overlay">
                    <div className="cart-modal">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2>Shopping Cart</h2>
                            <button onClick={placeOrder} disabled={!cart || cart.length === 0}>
                                Place Order
                            </button>
                        </div>
                        {cart.length === 0 ? (
                            <p>Your cart is empty</p>
                        ) : (
                            <>
                                {cart.map((item, index) => (
                                    <div key={index} className="cart-item">
                                        <img src={item.image} alt={item.name} className="cart-item-image" />
                                        <div className="cart-item-details">
                                            <span className="cart-item-name">{item.name}</span>
                                            <span>Qty: {item.quantity}</span>
                                            <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                        <button onClick={() => removeFromCart(item.name)}>Remove</button>
                                    </div>
                                ))}
                                <div className="cart-total">
                                    <strong>Total: ₹{getTotalPrice()}</strong>
                                </div>
                            </>
                        )}
                        <button onClick={() => setShowCart(false)}>Close</button>
                    </div>
                </div>
            )}

            {showDetails && (
                <div className="cart-overlay">
                    <div className="cart-modal">
                        <h2 style={{ color: 'white' }}>Product Details</h2>
                        {selectedProduct && (
                            <div className="product-details">
                                <img src={selectedProduct.image} alt={selectedProduct.name} style={{width: '200px', height: '200px', objectFit: 'cover', borderRadius: '10px'}} />
                                <h3 style={{ color: 'white' }}>{selectedProduct.name}</h3>
                                <p style={{ color: 'white' }}>Product ID: {selectedProduct.id}</p>
                                <p style={{ color: 'white' }}>Price: ₹{selectedProduct.price.toFixed(2)}</p>

                                {/* language selector for description */}
								<div style={{ marginTop: 10 }}>
									<label style={{ color: 'white', marginRight: 8 }}>Show description in:</label>
									<select
										value={detailLang}
										onChange={(e) => setDetailLang(e.target.value)}
										style={{ padding: '6px', borderRadius: 6 }}
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
								<div style={{ marginTop: 12, color: 'white', whiteSpace: 'pre-wrap' }}>
									{translatedDescription || selectedProduct.description || 'No description'}
								</div>

								{/* show existing feedbacks for this product */}
								{selectedProduct && (
									<div style={{ marginTop: 12 }}>
										<h4 style={{ color: 'white' }}>Feedback</h4>
										{(productFeedbacks.filter(f => String(f.productId) === String(selectedProduct.id))).length === 0 ? (
											<p style={{ color: 'white' }}>No feedback yet.</p>
										) : (
											<ul style={{ maxHeight: 220, overflow: 'auto', paddingLeft: 12 }}>
												{productFeedbacks.filter(f => String(f.productId) === String(selectedProduct.id)).map(f => (
													<li key={f.id} style={{ marginBottom: 8, color: 'white', background: 'rgba(0,0,0,0.15)', padding: 8, borderRadius: 6 }}>
														<div style={{ fontWeight: 700 }}>{f.authorName} <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>{new Date(f.date).toLocaleString()}</span></div>
														<div style={{ marginTop: 6 }}>{f.text}</div>
													</li>
												))}
											</ul>
										)}
										{/* quick add feedback from details */}
										<button className="button" style={{ marginTop: 8 }} onClick={() => openFeedbackModal(selectedProduct)}>Write Feedback</button>
									</div>
								)}
                            </div>
                        )}
                        <button onClick={() => setShowDetails(false)}>Close</button>
                    </div>
                </div>
            )}

            {showFeedbackModal && feedbackProduct && (
				<div className="cart-overlay">
					<div className="cart-modal">
						<h2 style={{ color: 'white' }}>Feedback — {feedbackProduct.name}</h2>
						<textarea value={feedbackText} onChange={(e)=>setFeedbackText(e.target.value)} rows={6} style={{ width: '100%', padding: 10 }} />
						<div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
							<button onClick={() => saveFeedback(feedbackProduct.id, feedbackText)}>Submit</button>
							<button onClick={() => setShowFeedbackModal(false)}>Cancel</button>
						</div>
					</div>
				</div>
			)}

            <div className="marquee">
                <marquee behavior="scroll" direction="left">Welcome to our site. India's premier platform for artisan products. Check out our amazing products!</marquee>
            </div>
            <div>
            <section id="home">
                <h2 style={{ color: 'black' }}>Craftora India's Premier Artisan Marketplace</h2>
                <p>Discover a variety of products at great prices. Shop now and enjoy amazing deals!</p>
            </section>
            </div>
            <section id="products">
                <h2 style={{ color: 'black' }}>Featured Products</h2>
                
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
                                <img src={product.imageUrl} alt={product.name} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, display: 'block', margin: '0 auto 8px' }} />
                                <h3>{product.name}</h3>
                                <p>Price: ₹{product.price.toFixed(2)}</p>
                                <button className="button" onClick={() => handleShowDetails(product.name, product.imageUrl, product.price, product.description, product.id)}>Details</button>
                                <button className="button" onClick={() => handleAddToCart(product.name, product.price, product.imageUrl)}>Add to Cart</button>
                                {/* Add Feedback button */}
                                <button className="button" onClick={() => openFeedbackModal(product)}>Feedback</button>
                            </div>
                        ))}
                        {filteredProducts.length === 0 && <p style={{textAlign: 'center', color: '#666'}}>No products found matching "{searchTerm}".</p>}
                    </div>
                ) : (
                    <>
                        {/* Admin Added Products */}
                        {adminProducts.length > 0 ? (
                            <div className="container">
                                {adminProducts.map(product => (
                                    <div key={product.id} className="product">
                                        <img src={product.imageUrl} alt={product.name} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, display: 'block', margin: '0 auto 8px' }} />
                                        <h3>{product.name}</h3>
                                        <p>Price: ₹{product.price.toFixed(2)}</p>
                                        <button className="button" onClick={() => handleShowDetails(product.name, product.imageUrl, product.price, product.description, product.id)}>Details</button>
                                        <button className="button" onClick={() => handleAddToCart(product.name, product.price, product.imageUrl)}>Add to Cart</button>
                                        {/* Add Feedback button */}
                                        <button className="button" onClick={() => openFeedbackModal(product)}>Feedback</button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{textAlign: 'center', color: '#666', fontSize: '18px', marginTop: '40px'}}>No products available. Admin can add products to display here.</p>
                        )}
                    </>
                )}

            </section>

            <section id="about">
                <h2 style={{ color: 'black' }}>About Us</h2>
                <p>We are a leading online shopping platform dedicated to providing our customers with the best products at unbeatable prices. Our mission is to support artisans, promote their crafts and preserve traditional art forms.</p>
            </section>

            <section id="contact">
                <h2 style={{ color: 'black' }}>Contact Us</h2>
                <p>If you have any questions or need assistance, feel free to reach out to us:</p>
                <p>Email: manikantasaikearthi@gmail.com</p>
                <p>Phone: 9032646737</p>
            </section>

            <section id="cart">
                <h2>Your Cart</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    
                    <button onClick={placeOrder} disabled={!cart || cart.length === 0}>
                        Place Order
                    </button>
                </div>

                {(!cart || cart.length === 0) ? (
                    <p>Cart is empty</p>
                ) : (
                    <ul>
                        {cart.map((item, idx) => (
                            <li key={idx}>
                                {item.name || item.title} — qty: {item.quantity || 1}
                                {/* brief display; adjust to match your cart item shape */}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <footer>
                <p>&copy; @2025 The Craftora. All rights reserved.</p>
            </footer>
        </div>
    );
}

export default Customer;