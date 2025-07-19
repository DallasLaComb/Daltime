import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
  });

  test('displays the title "Shift Scheduler"', () => {
    render(<App />);
    const titleElement = screen.getByText('Shift Scheduler');
    expect(titleElement).toBeInTheDocument();
  });

  test('renders the navigation bar with correct styling', () => {
    render(<App />);
    const navElement = screen.getByRole('navigation');
    expect(navElement).toHaveClass('bg-blue-500');
    expect(navElement).toHaveClass('p-4');
  });

  test('renders the container with proper styling', () => {
    render(<App />);
    const containerElement = screen.getByText('Shift Scheduler').closest('.container');
    expect(containerElement).toBeInTheDocument();
    expect(containerElement).toHaveClass('container');
    expect(containerElement).toHaveClass('mx-auto');
  });

  test('title has correct styling classes', () => {
    render(<App />);
    const titleElement = screen.getByText('Shift Scheduler');
    expect(titleElement).toHaveClass('text-white');
    expect(titleElement).toHaveClass('text-2xl');
    expect(titleElement).toHaveClass('font-bold');
  });
});