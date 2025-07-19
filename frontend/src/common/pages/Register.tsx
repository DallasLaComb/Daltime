import React, { useState } from 'react';
import logoWithName from '../../assets/logo-with-name.png';

function Register() {
  const [role, setRole] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  return (
    <div
      className="d-flex justify-content-center align-items-center min-vh-100"
      style={{ width: '100%' }}
    >
      {/* Logo at the top left */}
      <div
        className="d-flex justify-content-start"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
        }}
      >
        <img
          src={logoWithName}
          alt="ScheMegaBolt Logo"
          className="logo"
          style={{ height: '60px', margin: '16px' }}
        />
      </div>
      <form role="form">
        <h1>
          Register for <span className="text-primary">ScheMegaBolt</span>
        </h1>
        <div className="mb-3">
          <label htmlFor="register-email" className="form-label">
            Email
          </label>
          <input
            type="email"
            className="form-control"
            id="register-email"
            aria-label="Email"
            value={email}
            maxLength={255}
            onChange={(e) => setEmail(e.target.value.slice(0, 255))}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="register-password" className="form-label">
            Password
          </label>
          <input
            type="password"
            className="form-control"
            id="register-password"
            aria-label="Password"
            value={password}
            maxLength={64}
            onChange={(e) => setPassword(e.target.value.slice(0, 64))}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="register-firstName" className="form-label">
            First Name
          </label>
          <input
            type="text"
            className="form-control"
            id="register-firstName"
            aria-label="First Name"
            value={firstName}
            maxLength={50}
            onChange={(e) => setFirstName(e.target.value.slice(0, 50))}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="register-lastName" className="form-label">
            Last Name
          </label>
          <input
            type="text"
            className="form-control"
            id="register-lastName"
            aria-label="Last Name"
            value={lastName}
            maxLength={50}
            onChange={(e) => setLastName(e.target.value.slice(0, 50))}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="register-phoneNumber" className="form-label">
            Phone Number
          </label>
          <input
            type="tel"
            className="form-control"
            id="register-phoneNumber"
            aria-label="Phone Number"
            value={phoneNumber}
            maxLength={10}
            onChange={(e) =>
              setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))
            }
          />
        </div>
        <div className="mb-3">
          <label htmlFor="register-role" className="form-label">
            Role
          </label>
          <select
            className="form-control"
            id="register-role"
            aria-label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
            <option value="Employee">Employee</option>
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="register-companyId" className="form-label">
            Company ID
          </label>
          <input
            type="text"
            className="form-control"
            id="register-companyId"
            aria-label="Company ID"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Register
        </button>
      </form>
    </div>
  );
}

export default Register;
