import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
  });

  describe('Routing', () => {
    test('renders login page on /login route', () => {
      window.history.pushState({}, 'Login', '/login');
      render(<App />);
      expect(
        screen.getByRole('heading', { name: /login to daltime/i })
      ).toBeInTheDocument();
    });

    test('renders register page on /register route', () => {
      window.history.pushState({}, 'Register', '/register');
      render(<App />);
      expect(screen.getByText(/register for/i)).toBeInTheDocument();
    });
  });
});
