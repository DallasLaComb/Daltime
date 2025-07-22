import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';

const Dashboard: React.FC = () => {
  return (
    <Container fluid className="p-4 bg-light min-vh-100">
      <Row className="mb-4">
        <Col>
          <h1 className="text-center">Manager Dashboard</h1>
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

        <Col md={6} lg={4}>
          <Card>
            <Card.Body>
              <Card.Title>Team Status</Card.Title>
              <Card.Text>
                You currently have 12 team members. 3 pending reviews.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6} lg={4}>
          <Card>
            <Card.Body>
              <Card.Title>Reports</Card.Title>
              <Card.Text>
                View your recent performance and analytics in this section.
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard;
