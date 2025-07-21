import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from '../../../common/pages/Register';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('Register Component', () => {
  const setup = () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
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
      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );
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
      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );
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

  // Helper to fill the form for Employee role
  const fillForm = (overrides: Partial<Record<string, string>> = {}) => {
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

    fireEvent.change(emailInput, {
      target: { value: overrides.email ?? 'test@example.com' },
    });
    fireEvent.change(passwordInput, {
      target: { value: overrides.password ?? 'password123' },
    });
    fireEvent.change(firstNameInput, {
      target: { value: overrides.firstName ?? 'John' },
    });
    fireEvent.change(lastNameInput, {
      target: { value: overrides.lastName ?? 'Doe' },
    });
    fireEvent.change(phoneNumberInput, {
      target: { value: overrides.phoneNumber ?? '1234567890' },
    });
    fireEvent.change(roleSelect, {
      target: { value: overrides.role ?? 'Employee' },
    });
    if (overrides.role === 'Manager' || overrides.role === 'Admin') {
      // No managerID field for these roles
    } else {
      // Wait for managerID field to appear if Employee
      const managerIdInput = screen.queryByLabelText(
        /managerid/i
      ) as HTMLInputElement | null;
      if (managerIdInput) {
        fireEvent.change(managerIdInput, {
          target: { value: overrides.managerId ?? 'manager-123' },
        });
      }
    }
    fireEvent.change(companySelect, {
      target: {
        value: overrides.companyId ?? '0433bb9b-fd98-459a-8b2e-b48e854ace17',
      },
    });
  };

  describe('Conditional managerID field', () => {
    beforeEach(() => {
      render(
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      );
    });

    it('shows the managerID field only when role is Employee', () => {
      const roleSelect = screen.getByLabelText(/role/i) as HTMLSelectElement;

      // Initially, managerID field should not be visible
      expect(screen.queryByLabelText(/managerid/i)).not.toBeInTheDocument();

      // Select Employee
      fireEvent.change(roleSelect, { target: { value: 'Employee' } });
      expect(screen.getByLabelText(/managerid/i)).toBeInTheDocument();

      // Select Manager
      fireEvent.change(roleSelect, { target: { value: 'Manager' } });
      expect(screen.queryByLabelText(/managerid/i)).not.toBeInTheDocument();

      // Select Admin
      fireEvent.change(roleSelect, { target: { value: 'Admin' } });
      expect(screen.queryByLabelText(/managerid/i)).not.toBeInTheDocument();
    });

    it('allows input in the managerID field when visible', () => {
      const roleSelect = screen.getByLabelText(/role/i) as HTMLSelectElement;
      fireEvent.change(roleSelect, { target: { value: 'Employee' } });
      const managerIdInput = screen.getByLabelText(
        /managerid/i
      ) as HTMLInputElement;
      fireEvent.change(managerIdInput, { target: { value: 'manager-123' } });
      expect(managerIdInput.value).toBe('manager-123');
    });
  });

  it('submits the form with valid data', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    fillForm();
    const submitButton = screen.getByRole('button', { name: /register/i });
    fireEvent.click(submitButton);
    // Wait for the button to show loading state
    await waitFor(() => {
      expect(screen.getByText(/registering.../i)).toBeInTheDocument();
    });
  });

  it('shows validation error for empty fields', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const submitButton = screen.getByRole('button', { name: /register/i });

    // Submit the form within act to ensure state updates are processed
    await act(async () => {
      fireEvent.submit(submitButton.closest('form'));
    });

    // Wait for the validation error to appear with a longer timeout
    const errorMessage = await screen.findByText(
      /all fields are required/i,
      {},
      { timeout: 3000 }
    );
    expect(errorMessage).toBeInTheDocument();
  });

  it('shows validation error for invalid email', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );
    // Fill all fields except make email invalid, and fill managerID
    fillForm({ email: 'invalid-email' });
    const submitButton = screen.getByRole('button', { name: /register/i });
    // Submit the form within act to ensure state updates are processed
    await act(async () => {
      fireEvent.submit(submitButton.closest('form'));
    });
    // Wait for the email validation error to appear
    const errorMessage = await screen.findByText(
      /please enter a valid email address/i,
      {},
      { timeout: 3000 }
    );
    expect(errorMessage).toBeInTheDocument();
  });

  it('redirects to login page after successful registration', async () => {
    // Clear any previous mock calls
    mockNavigate.mockClear();

    // Mock the timer functions
    jest.useFakeTimers();

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    fillForm();
    const submitButton = screen.getByRole('button', { name: /register/i });

    // Trigger the submit
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Wait for success message to appear
    await waitFor(() => {
      expect(screen.getByText(/registration successful/i)).toBeInTheDocument();
    });

    // Run the timeout
    await act(async () => {
      jest.runAllTimers();
    });

    // Verify navigation occurred
    expect(mockNavigate).toHaveBeenCalledWith('/login');

    // Cleanup
    jest.useRealTimers();
    jest.resetModules();
  });
});
