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
    it('renders the form centered horizontally on the page', () => {
      setup();
      const form = screen.getByRole('form');
      // The form's parent containers should have Bootstrap horizontal centering classes
      expect(form.parentElement?.parentElement).toHaveClass(
        'row',
        'justify-content-center'
      );
      expect(form.parentElement).toHaveClass('col-12', 'col-md-8', 'col-lg-6');
    });
    it('renders the form with 6 column width on large screens', () => {
      setup();
      const form = screen.getByRole('form');
      // The col-lg-6 class should be on a parent div
      expect(form.parentElement).toHaveClass('col-lg-6');
    });
    it('renders the form with a 3px solid black border', () => {
      setup();
      const form = screen.getByRole('form');
      const style = window.getComputedStyle(form);
      expect(style.borderTopWidth).toBe('3px');
      expect(style.borderTopStyle).toBe('solid');
      expect(style.borderTopColor).toBe('rgb(0, 0, 0)');
    });

    it('shows "Daltime Logo with Name" image on desktop/tablet and hides it on mobile', () => {
      setup();

      // Desktop/tablet: logo container should be visible (not display: none)
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      window.dispatchEvent(new Event('resize'));
      const logoDesktop = screen.queryByAltText('Daltime Logo with Name');
      expect(logoDesktop).toBeInTheDocument();
      // Simulate Bootstrap's d-none d-md-flex: visible at >=768px
      if (logoDesktop) {
        expect(
          window.getComputedStyle(logoDesktop.parentElement as HTMLElement)
            .display
        ).not.toBe('none');
      }

      // Mobile: logo container should be hidden (display: none)
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      window.dispatchEvent(new Event('resize'));
      const logoMobile = screen.queryByAltText('Daltime Logo with Name');
      // The element is still in the DOM, but should be hidden by CSS
      if (logoMobile) {
        const logoContainer = logoMobile.closest('div');
        expect(logoContainer).toHaveClass('d-none');
        expect(logoContainer).toHaveClass('d-md-flex');
      }
    });
  });
});
