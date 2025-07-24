import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { AuthService } from '../common/services/auth/authService';

const Dashboard: React.FC = () => {
  const [managerId, setManagerId] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await AuthService.getUser();
        console.log('Raw response from AuthService.getUser():', response);

        if (!response.success) {
          console.error(
            'Failed to fetch user:',
            response.error || response.message
          );
          setError(response.error || 'Failed to fetch user');
          return;
        }

        const user = response.user || response.data?.user;
        console.log('Extracted user object:', user);

        if (!user) {
          console.error('User object is missing in response');
          setError('User not found in response');
          return;
        }

        if (user.role === 'Manager') {
          setManagerId(user.id);
        } else {
          console.warn('User is not a Manager:', user.role);
        }
      } catch (err) {
        console.error('Unexpected error in fetchUser:', err);
        setError('Unexpected error occurred');
      }
    };

    fetchUser();
  }, []);

  return (
    <Container fluid className="p-4 bg-light min-vh-100">
      <Row className="mb-4">
        <Col>
          <h1 className="text-center">Manager Dashboard</h1>
          {error && <p className="text-center text-danger">Error: {error}</p>}
          <p className="text-center text-muted">
            Manager ID: <strong>{managerId || 'Not available'}</strong>
          </p>
        </Col>
      </Row>
      <Row className="g-4">
        <Col md={6} lg={4}>
          <Card>
            <Card.Body>
              <Card.Title>Overview</Card.Title>
              <Card.Text>
                Welcome, manager. This is your dashboard. You can monitor
                activity, manage users, or view reports.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard;
