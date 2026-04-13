import React from 'react';
import { Link } from 'react-router-dom';
import { FaUtensils, FaChartBar, FaUsers, FaClipboardList, FaArrowRight, FaClock, FaShieldAlt } from 'react-icons/fa';
import './Landing.css';

const Landing = () => {
  return (
    <div className="landing-container">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <h1>MessMate</h1>
        </div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="#stats">Impact</a>
          <Link to="/login" className="login-link">Login</Link>
          <Link to="/signup" className="nav-cta">Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <span className="hero-badge">Next-Gen Mess Management</span>
          <h2>Revolutionize Your Dining Experience</h2>
          <p>
            Streamline meal tracking, inventory, and attendance with our all-in-one 
            digital solution. Built for students, managers, and admins who value efficiency.
          </p>
          <div className="hero-btns">
            <Link to="/signup" className="hero-btn-primary">
              Join Now <FaArrowRight style={{ marginLeft: '10px' }} />
            </Link>
            <Link to="/login" className="hero-btn-secondary">Explore Demo</Link>
          </div>
        </div>

        <div className="hero-image">
          <div className="hero-blob"></div>
          <div className="hero-card-mockup">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff4757' }}></div>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffba08' }}></div>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#2ed573' }}></div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Dashboard Overview</div>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
               <h4 style={{ marginBottom: '10px' }}>Today's Menu</h4>
               <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <FaUtensils color="var(--primary-color)" />
                  <div>
                    <div style={{ fontWeight: '600' }}>Executive Lunch</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rice, Dal, Paneer, Salad</div>
                  </div>
               </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '15px' }}>
                <FaUsers size={20} color="#45aaf2" style={{ marginBottom: '10px' }} />
                <div style={{ fontSize: '1.2rem', fontWeight: '800' }}>1,240</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Active Students</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '15px' }}>
                <FaChartBar size={20} color="#2ed573" style={{ marginBottom: '10px' }} />
                <div style={{ fontSize: '1.2rem', fontWeight: '800' }}>94%</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Satisfaction</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-section" id="stats">
        <div className="stat-item">
          <h4>50K+</h4>
          <p>Meals Served</p>
        </div>
        <div className="stat-item">
          <h4>20+</h4>
          <p>Messes Managed</p>
        </div>
        <div className="stat-item">
          <h4>99.9%</h4>
          <p>Uptime</p>
        </div>
        <div className="stat-item">
          <h4>10X</h4>
          <p>Faster Queue</p>
        </div>
      </section>

      {/* Features */}
      <section className="features-section" id="features">
        <div className="section-header">
          <h3>Powerful Features for Seamless Management</h3>
          <p>Everything you need to run a high-efficiency mess, from inventory to student feedback.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"><FaClock /></div>
            <h4>Real-time Attendance</h4>
            <p>Automated meal tracking with instant updates. No more manual entry errors.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FaClipboardList /></div>
            <h4>Smart Inventory</h4>
            <p>Keep track of stock levels and automate procurement requests effortlessly.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FaChartBar /></div>
            <h4>Advanced Analytics</h4>
            <p>Visualize consumption patterns and optimize waste management with data.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FaUsers /></div>
            <h4>Role-based Access</h4>
            <p>Unified platform with tailored dashboards for Students, Employees, and Admins.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FaShieldAlt /></div>
            <h4>Secure Payments</h4>
            <p>Integrated billing and fee management with high-grade security.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FaUtensils /></div>
            <h4>Menu Planning</h4>
            <p>Dynamic menu scheduling with dietary labels and nutritional info.</p>
          </div>
        </div>
      </section>

      <section style={{ padding: '8rem 10%', textAlign: 'center', background: 'linear-gradient(to bottom, transparent, rgba(255,123,0,0.05))'}}>
         <h3 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Ready to transform your mess?</h3>
         <Link to="/signup" className="hero-btn-primary" style={{ display: 'inline-block' }}>Get Started for Free</Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h2>MessMate</h2>
            <p>Building the future of campus dining. Efficient, transparent, and technology-driven.</p>
          </div>
          <div className="footer-links">
            <h5>Product</h5>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#">Pricing</a></li>
              <li><a href="#">Security</a></li>
            </ul>
          </div>
          <div className="footer-links">
            <h5>Company</h5>
            <ul>
              <li><a href="#">About Us</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
          <div className="footer-links">
            <h5>Support</h5>
            <ul>
              <li><a href="#">Help Center</a></li>
              <li><a href="#">API Docs</a></li>
              <li><a href="#">Status</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 MessMate. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
