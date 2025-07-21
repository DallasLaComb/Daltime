import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
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
    expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
  });

  it('allows only specific roles', () => {
    setup();
    const roleInput = screen.getByLabelText(/role/i) as HTMLSelectElement;
    fireEvent.change(roleInput, { target: { value: 'Admin' } });
    expect(roleInput.value).toBe('Admin');
    fireEvent.change(roleInput, { target: { value: 'Manager' } });
    expect(roleInput.value).toBe('Manager');
    fireEvent.change(roleInput, { target: { value: 'Employee' } });
    expect(roleInput.value).toBe('Employee');
    fireEvent.change(roleInput, { target: { value: 'InvalidRole' } });
    expect(roleInput.value).not.toBe('InvalidRole');
  });

  it('allows only specific companies', () => {
    setup();
    const companySelect = screen.getByLabelText(
      /company/i
    ) as HTMLSelectElement;

    // Check that the company options are available
    expect(screen.getByText('Meriden YMCA')).toBeInTheDocument();
    expect(screen.getByText('Wallingford YMCA')).toBeInTheDocument();
    expect(screen.getByText('Southington YMCA')).toBeInTheDocument();

    // Test selecting a company
    fireEvent.change(companySelect, {
      target: { value: '0433bb9b-fd98-459a-8b2e-b48e854ace17' },
    });
    expect(companySelect.value).toBe('0433bb9b-fd98-459a-8b2e-b48e854ace17');
  });

  describe('Min and Max Length validation', () => {
    const setup = () => {
      render(<Register />);
    };
    it('Maximum length for email is 255 characters', () => {
      setup();
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: 'a'.repeat(256) } });
      expect(emailInput.value.length).toBeLessThanOrEqual(255);
    });
    it('Maximum length for password is 64 character', () => {
      setup();
      const passwordInput = screen.getByLabelText(
        /password/i
      ) as HTMLInputElement;
      fireEvent.change(passwordInput, { target: { value: 'a'.repeat(65) } });
      expect(passwordInput.value.length).toBeLessThanOrEqual(64);
    });
    it('Maximum length for first name is 50 characters', () => {
      setup();
      const firstNameInput = screen.getByLabelText(
        /first name/i
      ) as HTMLInputElement;
      fireEvent.change(firstNameInput, { target: { value: 'a'.repeat(51) } });
      expect(firstNameInput.value.length).toBeLessThanOrEqual(50);
    });
    it('Maximum length for last name is 50 characters', () => {
      setup();
      const lastNameInput = screen.getByLabelText(
        /last name/i
      ) as HTMLInputElement;
      fireEvent.change(lastNameInput, { target: { value: 'a'.repeat(51) } });
      expect(lastNameInput.value.length).toBeLessThanOrEqual(50);
    });
    it('Length for phone number is 10 characters', () => {
      setup();
      const phoneNumberInput = screen.getByLabelText(
        /phone number/i
      ) as HTMLInputElement;
      fireEvent.change(phoneNumberInput, { target: { value: '12345678901' } });
      expect(phoneNumberInput.value.length).toBe(10);
    });
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
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 1024,
        });
        window.dispatchEvent(new Event('resize'));
      });

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
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 500,
        });
        window.dispatchEvent(new Event('resize'));
      });

      const logoMobile = screen.queryByAltText('Daltime Logo with Name');
      // The element is still in the DOM, but should be hidden by CSS
      if (logoMobile) {
        const logoContainer = logoMobile.closest('div');
        expect(logoContainer).toHaveClass('d-none');
        expect(logoContainer).toHaveClass('d-md-flex');
      }
    });

    it('shows "Already have an account? Login here" link', () => {
      setup();
      const link = screen.getByText(
        /already have an account\?[\s]*login here/i
      );
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/login');
    });

    it('renders only the registration form full screen on mobile (no extra background)', () => {
      // Simulate mobile
      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 500,
        });
        window.dispatchEvent(new Event('resize'));
      });

      setup();
      const form = screen.getByRole('form');
      // Should have h-100 w-100 and be the only visible element
      expect(form).toHaveClass('h-100', 'w-100');
      // The parent should be d-block d-md-none h-100 w-100
      expect(form.parentElement).toHaveClass(
        'd-block',
        'd-md-none',
        'h-100',
        'w-100'
      );
      // There should be no visible container or row elements
      const containers = document.querySelectorAll('.container, .row');
      containers.forEach((el) => {
        expect(el).toHaveClass('d-none');
      });
    });
  });

  describe('Form submission', () => {
    const fillForm = () => {
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(
        /password/i
      ) as HTMLInputElement;
      const firstNameInput = screen.getByLabelText(
        /first name/i
      ) as HTMLInputElement;
      const lastNameInput = screen.getByLabelText(
        /last name/i
      ) as HTMLInputElement;
      const phoneNumberInput = screen.getByLabelText(
        /phone number/i
      ) as HTMLInputElement;
      const roleSelect = screen.getByLabelText(/role/i) as HTMLSelectElement;
      const companySelect = screen.getByLabelText(
        /company/i
      ) as HTMLSelectElement;

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(firstNameInput, { target: { value: 'John' } });
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
      fireEvent.change(phoneNumberInput, { target: { value: '1234567890' } });
      fireEvent.change(roleSelect, { target: { value: 'Employee' } });
      fireEvent.change(companySelect, {
        target: { value: '0433bb9b-fd98-459a-8b2e-b48e854ace17' },
      });
    };

    it('submits the form with valid data', async () => {
      render(<Register />);

      fillForm();

      const submitButton = screen.getByRole('button', { name: /register/i });
      fireEvent.click(submitButton);

      // Wait for the button to show loading state
      await waitFor(() => {
        expect(screen.getByText(/registering.../i)).toBeInTheDocument();
      });
    });

    it('shows validation error for empty fields', async () => {
      render(<Register />);

      const submitButton = screen.getByRole('button', { name: /register/i });

      // Submit the form within act to ensure state updates are processed
      await act(async () => {
        fireEvent.submit(submitButton.closest('form'));
      });

      // Wait for the validation error to appear with a longer timeout
      const errorMessage = await screen.findByText(/all fields are required/i, {}, { timeout: 3000 });
      expect(errorMessage).toBeInTheDocument();
    });

    it('shows validation error for invalid email', async () => {
      render(<Register />);

      // Fill all fields except make email invalid
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(
        /password/i
      ) as HTMLInputElement;
      const firstNameInput = screen.getByLabelText(
        /first name/i
      ) as HTMLInputElement;
      const lastNameInput = screen.getByLabelText(
        /last name/i
      ) as HTMLInputElement;
      const phoneNumberInput = screen.getByLabelText(
        /phone number/i
      ) as HTMLInputElement;
      const roleSelect = screen.getByLabelText(/role/i) as HTMLSelectElement;
      const companySelect = screen.getByLabelText(
        /company/i
      ) as HTMLSelectElement;

      // Use act for all state-changing operations
      act(() => {
        fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.change(firstNameInput, { target: { value: 'John' } });
        fireEvent.change(lastNameInput, { target: { value: 'Doe' } });
        fireEvent.change(phoneNumberInput, { target: { value: '1234567890' } });
        fireEvent.change(roleSelect, { target: { value: 'Employee' } });
        fireEvent.change(companySelect, {
          target: { value: '0433bb9b-fd98-459a-8b2e-b48e854ace17' },
        });
      });

      const submitButton = screen.getByRole('button', { name: /register/i });

      // Submit the form within act to ensure state updates are processed
      await act(async () => {
        fireEvent.submit(submitButton.closest('form'));
      });

      // Wait for the email validation error to appear
      const errorMessage = await screen.findByText(/please enter a valid email address/i, {}, { timeout: 3000 });
      expect(errorMessage).toBeInTheDocument();
    });
  });
});
