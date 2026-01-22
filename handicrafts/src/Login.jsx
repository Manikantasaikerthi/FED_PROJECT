import { useState, useEffect } from 'react'
import Terms from './terms.jsx'
import Customer from './customer.jsx'
import Artisan from './artisan.jsx'
import Admin from './admin.jsx'
import Consultant from './consultant.jsx'
import './Login.css'

function Login() {
    // extend form to include password (removed email)
    const [formData, setFormData] = useState({
        username: '',
        number: '',
        password: ''
    });

	// new: signup state
	const [showSignup, setShowSignup] = useState(false);
	const [signupRole, setSignupRole] = useState('customer'); // 'customer' | 'artisan'
	const [signupForm, setSignupForm] = useState({ username: '', password: '', phone: '' });

    const [showTerms, setShowTerms] = useState(false);
    const [showCustomer, setShowCustomer] = useState(false);
    const [showArtisan, setShowArtisan] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);
    const [showConsultant, setShowConsultant] = useState(false);

	// captcha state (simple math captcha)
	const [captchaQuestion, setCaptchaQuestion] = useState('');
	const [captchaAnswer, setCaptchaAnswer] = useState('');
	const [captchaInput, setCaptchaInput] = useState('');

    useEffect(() => {
        // if user already logged in, route to appropriate view quickly
        try {
            const user = JSON.parse(localStorage.getItem('user') || 'null');
            if (user && user.role) {
                if (user.role === 'admin') setShowAdmin(true);
                else if (user.role === 'artisan') setShowArtisan(true);
                else if (user.role === 'consultant') setShowConsultant(true);
                else setShowCustomer(true);
            }
        } catch (e) {}
    }, []);

    useEffect(() => {
		generateCaptcha();
	}, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

	// new: signup input change
	const handleSignupChange = (e) => {
		const { name, value } = e.target;
		setSignupForm(prev => ({ ...prev, [name]: value }));
	};

	// new: handle signup
	const handleSignup = () => {
		const { username, password, phone } = signupForm;
		if (!username || !password || !phone) {
			alert('Please fill all signup fields');
			return;
		}

		if (signupRole === 'customer') {
			const existing = JSON.parse(localStorage.getItem('customers') || '[]');
			if (existing.find(u => u.username === username)) {
				alert('Customer username already exists');
				return;
			}
			const entry = { id: `cust_${Date.now()}`, username, password, phone };
			localStorage.setItem('customers', JSON.stringify([entry, ...existing]));
			alert('Customer signup successful. You can now login.');
			setShowSignup(false);
			setSignupForm({ username:'', password:'', phone:'' });
		} else { // artisan signup -> request
			const requests = JSON.parse(localStorage.getItem('artisanRequests') || '[]');
			if (requests.find(r => r.username === username)) {
				alert('You already submitted a signup request. Please wait for consultant approval.');
				return;
			}
			const req = { id: `artisan_req_${Date.now()}`, username, password, phone, status: 'pending', requestedAt: new Date().toISOString() };
			localStorage.setItem('artisanRequests', JSON.stringify([req, ...requests]));
			alert('Artisan signup request submitted. Consultant will review.');
			setShowSignup(false);
			setSignupForm({ username:'', password:'', phone:'' });
		}
	};

	// generate a simple math captcha like "12 + 7 ="
	function generateCaptcha() {
		const a = Math.floor(Math.random() * 40) + 5; // 5..44
		const b = Math.floor(Math.random() * 40) + 1; // 1..40
		setCaptchaQuestion(`${a} + ${b} =`);
		setCaptchaAnswer(String(a + b));
		setCaptchaInput('');
	}

    const validateLogin = () => {
		// ensure captcha correct before proceeding
		if (captchaInput.trim() === '') {
			alert('Please solve the captcha before logging in.');
			return;
		}
		if (String(captchaInput).trim() !== String(captchaAnswer).trim()) {
			alert('Captcha incorrect. Please try again.');
			generateCaptcha();
			return;
		}

        // keep original hardcoded checks for admin/consultant/test account
        const validUsername = "Manikanta";
        const validNumber = "9032646737";
        const validPassword = "manikanta123"; // use password instead of email

        const artisanUsername = "artisan";
        const artisanNumber = "123";
        const artisanPassword = "artisan123";

        const adminUsername = "admin";
        const adminNumber = "1234";
        const adminPassword = "admin123";

        const consultantUsername = "consultant";
        const consultantNumber = "12345";
        const consultantPassword = "consultant123";

        // normalize username for simpler checks
        const uname = (formData.username || '').trim().toLowerCase();

		// first check stored customers
		try {
			const customers = JSON.parse(localStorage.getItem('customers') || '[]');
			const found = (customers || []).find(c => c.username === formData.username && c.password === formData.password && c.phone === formData.number);
			if (found) {
				localStorage.setItem('user', JSON.stringify({ id: found.id, username: found.username, role: 'customer' }));
				alert("Customer Login successful!");
				setShowCustomer(true);
				return;
			}
		} catch (e) {}

		// check approved artisans stored in 'artisans'
		try {
			const artisans = JSON.parse(localStorage.getItem('artisans') || '[]');
			const foundA = (artisans || []).find(a => a.username === formData.username && a.password === formData.password && a.phone === formData.number);
			if (foundA) {
				localStorage.setItem('user', JSON.stringify({ id: foundA.id, username: foundA.username, role: 'artisan' }));
				alert("Artisan Login successful!");
				setShowArtisan(true);
				return;
			}
		} catch (e) {}

        // fallbacks to original simple checks (keeps older demo flows)
        if (formData.username === validUsername && 
            formData.number === validNumber && 
            formData.password === validPassword) {
            localStorage.setItem('user', JSON.stringify({
                id: 'customer1',
                username: validUsername,
                role: 'customer'
            }));
            alert("Customer Login successful!");
            setShowCustomer(true);
        } else if (formData.username === artisanUsername && 
                   formData.number === artisanNumber && 
                   formData.password === artisanPassword) {
            localStorage.setItem('user', JSON.stringify({
                id: 'artisan',
                username: artisanUsername,
                role: 'artisan'
            }));
            alert("Artisan Login successful!");
            setShowArtisan(true);
        } else if (uname === adminUsername || (
                   formData.username === adminUsername &&
                   formData.number === adminNumber &&
                   formData.password === adminPassword)) {
            localStorage.setItem('user', JSON.stringify({
                id: 'admin',
                username: adminUsername,
                role: 'admin'
            }));
            alert("Admin Login successful!");
            setShowAdmin(true);
        } else if (uname === consultantUsername || (
                   formData.username === consultantUsername &&
                   formData.number === consultantNumber &&
                   formData.password === consultantPassword)) {
            localStorage.setItem('user', JSON.stringify({
                id: 'consultant',
                username: consultantUsername,
                role: 'consultant'
            }));
            alert("Consultant Login successful!");
            setShowConsultant(true);
        } else {
            alert("Invalid credentials");
        }
    };

    // handle captcha input change
	const handleCaptchaChange = (e) => {
		setCaptchaInput(e.target.value);
	};

    if (showTerms) {
        return <Terms />;
    }

    if (showCustomer) {
        return <Customer />;
    }

    if (showAdmin) {
        return <Admin />;
    }

    if (showConsultant) {
        return <Consultant />;
    }

    if (showArtisan) {
        return <Artisan />;
    }

    return (
        <div className="login-page">
            <header className="site-header">
                <div className="brand">
                    <h1>THE CRAFTORA</h1>
                    <p className="tagline">India's premier platform for artisans</p>
                </div>
            </header>

            <main className="login-main">
                <section className="login-card">
					{/* Toggle between Login and Signup */}
					<div style={{ display:'flex', gap:8, marginBottom:12 }}>
						<button className="btn primary" onClick={() => setShowSignup(false)} style={{ opacity: showSignup ? 0.7 : 1 }}>Login</button>
						<button className="btn ghost" onClick={() => setShowSignup(true)} style={{ opacity: showSignup ? 1 : 0.8 }}>Sign Up</button>
					</div>

					{!showSignup ? (
						<>
							<h2 style={{ color: "white" }}>Sign In</h2>
							<p className="muted">Enter your credentials to continue</p>

							<input type="text" name="username" placeholder="Name" value={formData.username} onChange={handleInputChange} className="input" />
							<input type="text" name="number" placeholder="Phone Number" value={formData.number} onChange={handleInputChange} className="input" />
							<input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleInputChange} className="input" />

							{/* Captcha UI */}
							<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
								<div style={{ padding: '8px 12px', background: '#fff', color: '#000', borderRadius: 8, fontWeight: 700 }}>
									{captchaQuestion}
								</div>
								<input
									type="text"
									placeholder="Enter result"
									value={captchaInput}
									onChange={handleCaptchaChange}
									className="input"
									style={{ width: 120 }}
								/>
								<button type="button" onClick={generateCaptcha} className="btn ghost" style={{ padding: '8px 10px' }}>
									↻
								</button>
							</div>

							<div className="actions">
								<button type="button" className="btn primary" onClick={validateLogin}>Submit</button>
								<button type="button" className="btn ghost" onClick={() => setShowTerms(true)}>Terms</button>
							</div>
						</>
					) : (
						<>
							<h2 style={{ color: "white" }}>Sign Up</h2>
							<p className="muted">Choose account type and create an account</p>

							<div style={{ display:'flex', gap:8 }}>
								<button onClick={() => setSignupRole('customer')} className="btn" style={{ background: signupRole==='customer' ? 'linear-gradient(90deg,var(--accent),var(--accent-2))' : 'transparent' }}>Customer</button>
								<button onClick={() => setSignupRole('artisan')} className="btn" style={{ background: signupRole==='artisan' ? 'linear-gradient(90deg,var(--accent),var(--accent-2))' : 'transparent' }}>Artisan</button>
							</div>

							<input type="text" name="username" placeholder="Username" value={signupForm.username} onChange={handleSignupChange} className="input" />
							<input type="password" name="password" placeholder="Password" value={signupForm.password} onChange={handleSignupChange} className="input" />
							<input type="text" name="phone" placeholder="Phone Number" value={signupForm.phone} onChange={handleSignupChange} className="input" />

							<div className="actions">
								<button type="button" className="btn primary" onClick={handleSignup}>Create Account</button>
								<button type="button" className="btn ghost" onClick={() => setShowSignup(false)}>Cancel</button>
							</div>
						</>
					)}
                </section>

                <aside className="policy-card">
                    <h3>Why Craftora?</h3>
                    <p className="muted">Support local artisans, discover authentic products, and enjoy secure shopping.</p>
                    <ul>
                        <li>Verified artisans</li>
                        <li>Easy product submission</li>
                        <li>Multi-language product descriptions</li>
                    </ul>
                </aside>
            </main>

            <footer className="site-footer">
                <p style={{ color: 'white' }}>Customer satisfaction is our priority.</p>
            </footer>
        </div>
    );
}

export default Login;