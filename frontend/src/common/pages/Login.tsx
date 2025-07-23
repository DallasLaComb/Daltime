import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import logoWithName from '../../assets/logo-with-name.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch(`${process.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMsg(result.message || 'Login failed');
        setLoading(false);
        return;
      }

      const { user } = result.data;
      const role = user.role.toLowerCase();
      navigate(`/${role}/dashboard`);
    } catch {
      setErrorMsg('Unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderFormFields = () => (
    <>
      <div className="mb-3">
        <label htmlFor="login-email" className="form-label">
          Email <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          type="email"
          className="form-control"
          id="login-email"
          aria-label="Email"
          value={email}
          maxLength={255}
          onChange={(e) => setEmail(e.target.value.slice(0, 255))}
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="login-password" className="form-label">
          Password <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          type="password"
          className="form-control"
          id="login-password"
          aria-label="Password"
          value={password}
          maxLength={64}
          onChange={(e) => setPassword(e.target.value.slice(0, 64))}
          required
        />
      </div>
    </>
  );

  const renderRequiredNote = (
    <p className="text-muted">
      <span style={{ color: 'red' }}>*</span> All fields are required
    </p>
  );

  const renderError = (
    <div
      data-testid="login-error-message"
      role="alert"
      className="alert alert-danger"
      aria-hidden={!errorMsg}
      style={{ display: errorMsg ? 'block' : 'none' }}
    >
      {errorMsg}
    </div>
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
        <div className="d-block d-md-none h-100 w-100">
          <form
            role="form"
            className="bg-white h-100 w-100 p-4 border-0 rounded d-flex flex-column justify-content-center"
            style={{ boxShadow: 'none', border: 'none' }}
            onSubmit={handleLogin}
          >
            <h1>
              Login to <span className="text-primary">Daltime</span>
            </h1>
            {renderError}
            {renderFormFields()}
            {renderRequiredNote}
            <button
              type="submit"
              className="btn btn-primary position-relative"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
            <div className="mt-3 text-center">
              <Link
                to="/register"
                className="text-primary text-decoration-underline"
              >
                Don't have an account? Register here
              </Link>
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
                onSubmit={handleLogin}
              >
                <h1>
                  Login to <span className="text-primary">Daltime</span>
                </h1>
                {renderError}
                {renderFormFields()}
                {renderRequiredNote}
                <button
                  type="submit"
                  className="btn btn-primary position-relative"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </button>
                <div className="mt-3 text-center">
                  <Link
                    to="/register"
                    className="text-primary text-decoration-underline"
                  >
                    Don't have an account? Register here
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
