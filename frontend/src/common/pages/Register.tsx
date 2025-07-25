import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logoWithName from '../../assets/logo-with-name.png';
import { AuthService } from '../services/auth/authService';
import type { RegisterRequest } from '../types/auth';

function Register() {
  const navigate = useNavigate();
  const allowedRoles = ['Admin', 'Manager', 'Employee'];
  const [role, setRole] = useState<string>('');
  const [managerId, setManagerId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [companyId, setCompanyId] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const companies = [
    { id: '0433bb9b-fd98-459a-8b2e-b48e854ace17', name: 'Meriden YMCA' },
    { id: '29d2410a-db42-433f-8e00-649f0efb97bd', name: 'Wallingford YMCA' },
    { id: 'dde77bbb-b99c-4d7b-af4c-d6e19606f1d3', name: 'Southington YMCA' },
  ];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (
      !email ||
      !password ||
      !firstName ||
      !lastName ||
      !phoneNumber ||
      !role ||
      !companyId ||
      (role === 'Employee' && !managerId)
    ) {
      setError('All fields are required');
      return;
    }

    if (!allowedRoles.includes(role)) {
      setError('Invalid role selected');
      return;
    }

    if (!companies.some((c) => c.id === companyId)) {
      setError('Invalid company selected');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (phoneNumber.length !== 10) {
      setError('Phone number must be exactly 10 digits');
      return;
    }

    setIsLoading(true);

    try {
      const registrationData: RegisterRequest = {
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
        role,
        companyId,
        ...(role === 'Employee' ? { managerId } : {}),
      };

      const response = await AuthService.register(registrationData);

      if (response.success) {
        setSuccess('Registration successful! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        setError(response.error || 'Registration failed');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderRequiredNote = (
    <p className="text-muted">
      <span style={{ color: 'red' }}>*</span> All fields are required
    </p>
  );

  const renderFormFields = () => (
    <>
      <div className="mb-3">
        <label htmlFor="register-email" className="form-label">
          Email <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          type="email"
          className="form-control"
          id="register-email"
          aria-label="Email"
          value={email}
          maxLength={255}
          onChange={(e) => setEmail(e.target.value.slice(0, 255))}
          required
        />
      </div>
      <div className="mb-3">
        <label htmlFor="register-password" className="form-label">
          Password <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          type="password"
          className="form-control"
          id="register-password"
          aria-label="Password"
          value={password}
          maxLength={64}
          onChange={(e) => setPassword(e.target.value.slice(0, 64))}
          required
        />
      </div>
      <div className="mb-3">
        <label htmlFor="register-firstName" className="form-label">
          First Name <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          type="text"
          className="form-control"
          id="register-firstName"
          aria-label="First Name"
          value={firstName}
          maxLength={50}
          onChange={(e) => setFirstName(e.target.value.slice(0, 50))}
          required
        />
      </div>
      <div className="mb-3">
        <label htmlFor="register-lastName" className="form-label">
          Last Name <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          type="text"
          className="form-control"
          id="register-lastName"
          aria-label="Last Name"
          value={lastName}
          maxLength={50}
          onChange={(e) => setLastName(e.target.value.slice(0, 50))}
          required
        />
      </div>
      <div className="mb-3">
        <label htmlFor="register-phoneNumber" className="form-label">
          Phone Number <span style={{ color: 'red' }}>*</span>
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
          required
        />
      </div>
      <div className="mb-3">
        <label htmlFor="register-role" className="form-label">
          Role <span style={{ color: 'red' }}>*</span>
        </label>
        <select
          className="form-control"
          id="register-role"
          aria-label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        >
          <option value="">Select a role</option>
          {allowedRoles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      {role === 'Employee' && (
        <div className="mb-3">
          <label htmlFor="register-managerId" className="form-label">
            ManagerID <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            className="form-control"
            id="register-managerId"
            aria-label="managerID"
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            required
          />
        </div>
      )}
      <div className="mb-3">
        <label htmlFor="register-companyId" className="form-label">
          Company <span style={{ color: 'red' }}>*</span>
        </label>
        <select
          className="form-control"
          id="register-companyId"
          aria-label="Company"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          required
        >
          <option value="">Select a company</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <div className="min-vh-100 w-100">
      {!isMobile && (
        <div
          className="d-none d-md-flex justify-content-start"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}
        >
          <img
            src={logoWithName}
            alt="Daltime Logo with Name"
            className="logo"
            style={{ height: '60px', margin: '16px' }}
          />
        </div>
      )}
      {isMobile ? (
        <div
          className="d-block d-md-none h-100 w-100"
          data-testid="mobile-form-bg"
        >
          <form
            role="form"
            className="bg-white h-100 w-100 p-4 border-0 rounded d-flex flex-column justify-content-center"
            style={{ boxShadow: 'none', border: 'none' }}
            onSubmit={handleSubmit}
          >
            <h1>
              Register for <span className="text-primary">Daltime</span>
            </h1>
            <div
              data-testid="register-error-message"
              role="alert"
              className="alert alert-danger"
              aria-hidden={!error}
              style={{ display: error ? 'block' : 'none' }}
            >
              {error}
            </div>
            <div
              data-testid="register-success-message"
              role="alert"
              className="alert alert-success"
              aria-hidden={!success}
              style={{ display: success ? 'block' : 'none' }}
            >
              {success}
            </div>
            {renderFormFields()}
            <button
              type="submit"
              className="btn btn-primary position-relative"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Registering...
                </>
              ) : (
                'Register'
              )}
            </button>
            <div className="mt-3 text-center">
              <a
                href="/login"
                className="text-primary text-decoration-underline"
              >
                Already have an account? Login here
              </a>
            </div>
          </form>
        </div>
      ) : (
        <div className="container">
          <div className="row min-vh-100 d-flex align-items-center justify-content-center w-100">
            <div className="col-12 col-md-8 col-lg-6">
              <form
                role="form"
                className="bg-white p-4 border-0 border-md border-3 rounded"
                style={{
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  border: '3px solid #000',
                }}
                onSubmit={handleSubmit}
                data-testid="desktop-form"
              >
                <h1>
                  Register for <span className="text-primary">Daltime</span>
                </h1>
                <div
                  data-testid="register-error-message"
                  role="alert"
                  className="alert alert-danger"
                  aria-hidden={!error}
                  style={{ display: error ? 'block' : 'none' }}
                >
                  {error}
                </div>
                <div
                  data-testid="register-success-message"
                  role="alert"
                  className="alert alert-success"
                  aria-hidden={!success}
                  style={{ display: success ? 'block' : 'none' }}
                >
                  {success}
                </div>
                {renderFormFields()}
                {renderRequiredNote}

                <button
                  type="submit"
                  className="btn btn-primary position-relative"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Registering...
                    </>
                  ) : (
                    'Register'
                  )}
                </button>
                <div className="mt-3 text-center">
                  <a
                    href="/login"
                    className="text-primary text-decoration-underline"
                  >
                    Already have an account? Login here
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Register;
