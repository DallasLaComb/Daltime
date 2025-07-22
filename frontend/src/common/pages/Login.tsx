import React, { useState } from 'react';
import {
  Form,
  Button,
  Container,
  Row,
  Col,
  Spinner,
  Alert,
} from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import logoWithName from '../../assets/logo-with-name.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setErrorMsg(result.message || 'Login failed');
        setLoading(false);
        return;
      }

      const { user } = result.data;
      const role = user.role.toLowerCase();
      navigate(`/${role}/dashboard`);
    } catch (err) {
      setErrorMsg('Unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container
      fluid
      className="d-flex align-items-center justify-content-center min-vh-100 bg-light position-relative"
    >
      <div className="position-absolute top-0 start-0 p-3 d-none d-md-block">
        <img
          src={logoWithName}
          alt="Logo"
          style={{ height: '40px', objectFit: 'contain' }}
        />
      </div>
      <Row className="w-100 justify-content-center">
        <Col xs={12} sm={10} md={6} lg={4}>
          <h2 className="text-center mb-4">Login</h2>
          <Form onSubmit={handleLogin} aria-label="Login Form">
            <Form.Group controlId="email" className="mb-3">
              <Form.Label>Email address</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
                aria-required="true"
              />
            </Form.Group>

            <Form.Group controlId="password" className="mb-4">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
                aria-required="true"
              />
            </Form.Group>

            {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}

            <div className="d-grid mb-3">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner
                      animation="border"
                      size="sm"
                      role="status"
                      className="me-2"
                    />
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </Button>
            </div>

            <div className="text-center">
              <span>Don't have an account? </span>
              <Link to="/register">Register here</Link>
            </div>
          </Form>
        </Col>
      </Row>
    </Container>
  );
};

export default Login;
