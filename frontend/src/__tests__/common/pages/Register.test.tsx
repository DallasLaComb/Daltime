import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// import userEvent from '@testing-library/user-event'; // Uncomment if using userEvent
import Register from '../../../common/pages/Register';

describe('Register Component', () => {
  const setup = () => {
    render(<Register />);
  };

  it('renders all required input fields', () => {
    setup();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company id/i)).toBeInTheDocument();
  });
  //Generate a test to make sure that role can only Admin, Manager, Employee
  it('allows only specific roles', () => {
    setup();
    const roleInput = screen.getByLabelText(/role/i);
    fireEvent.change(roleInput, { target: { value: 'Admin' } });
    expect(roleInput.value).toBe('Admin');
    fireEvent.change(roleInput, { target: { value: 'Manager' } });
    expect(roleInput.value).toBe('Manager');
    fireEvent.change(roleInput, { target: { value: 'Employee' } });
    expect(roleInput.value).toBe('Employee');
    fireEvent.change(roleInput, { target: { value: 'InvalidRole' } });
    expect(roleInput.value).not.toBe('InvalidRole');
  });
});
describe('Min and Max Length validation', () => {
  const setup = () => {
    render(<Register />);
  };
  it('Maximum length for email is 255 characters', () => {
    setup();
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'a'.repeat(256) } });
    expect(emailInput.value.length).toBeLessThanOrEqual(255);
  });
  it('Maximum length for password is 64 character', () => {
    setup();
    const passwordInput = screen.getByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: 'a'.repeat(65) } });
    expect(passwordInput.value.length).toBeLessThanOrEqual(64);
  });
  it('Maximum length for first name is 50 characters', () => {
    setup();
    const firstNameInput = screen.getByLabelText(/first name/i);
    fireEvent.change(firstNameInput, { target: { value: 'a'.repeat(51) } });
    expect(firstNameInput.value.length).toBeLessThanOrEqual(50);
  });
  it('Maximum length for last name is 50 characters', () => {
    setup();
    const lastNameInput = screen.getByLabelText(/last name/i);
    fireEvent.change(lastNameInput, { target: { value: 'a'.repeat(51) } });
    expect(lastNameInput.value.length).toBeLessThanOrEqual(50);
  });
  it('Length for phone number is 10 characters', () => {
    setup();
    const phoneNumberInput = screen.getByLabelText(/phone number/i);
    fireEvent.change(phoneNumberInput, { target: { value: '12345678901' } });
    expect(phoneNumberInput.value.length).toBe(10);
  });
  describe('Styling requirements', () => {
    const setup = () => {
      render(<Register />);
    };
    it('renders the form centered both vertically and horizontally on the page', () => {
      setup();
      const form = screen.getByRole('form');
      // Check for Bootstrap centering classes or styles
      expect(form.parentElement).toHaveClass(
        'd-flex',
        'justify-content-center',
        'align-items-center'
      );
      // Optionally, check for min-vh-100 or similar for vertical centering
      expect(form.parentElement).toHaveClass('min-vh-100');
    });
    it('renders the logo on the top left of the page', () => {
      setup();
      const logo = screen.getByAltText('ScheMegaBolt Logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveClass('logo'); // Assuming the logo has a class 'logo'
      // Check if the logo is positioned correctly
      expect(logo.parentElement).toHaveClass('d-flex', 'justify-content-start');
    });
  });
});
