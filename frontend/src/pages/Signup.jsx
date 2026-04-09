import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

const Signup = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', studentId: '' });
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/register/student', formData);
      toast.success(response.data.message || 'Registration successful! Please login.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '450px' }}>
        <div className="login-header">
          <h2>Smart Mess Management</h2>
          <p>Create a New Student Account</p>
        </div>
        <form onSubmit={handleSignup}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Full Name</label>
              <input type="text" name="name" placeholder="John Doe" onChange={handleChange} required />
            </div>
            <div className="form-group" style={{ width: '130px' }}>
              <label>Student ID</label>
              <input type="text" name="studentId" placeholder="r1234" onChange={handleChange} required />
            </div>
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" name="email" placeholder="student@gmail.com" onChange={handleChange} required />
          </div>
          <div className="form-group">
              <label>Password</label>
              <input type="password" name="password" placeholder="••••••••" onChange={handleChange} required />
          </div>
          <button type="submit" className="btn-primary" style={{ marginBottom: '15px' }}>Sign Up</button>
        </form>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>Sign In here</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
