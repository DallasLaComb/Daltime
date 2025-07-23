describe('Login Page', () => {
  it('shows login form', () => {
    cy.visit('/login');

    // Use label text or id
    cy.get('#login-email').should('exist');
    cy.get('#login-password').should('exist');

    // Optional: check visible text
    cy.contains('Login to Daltime').should('exist');
  });

  it('logs in with valid credentials', () => {
    cy.visit('/login');

    cy.get('#login-email').type('dallasmanager@gmail.com');
    cy.get('#login-password').type('yourPasswordHere'); // use a valid test password
    cy.get('button[type="submit"]').click();

    // Adjust redirect check if needed (e.g., /manager/dashboard or /employee/dashboard)
    cy.url().should('include', '/dashboard');
  });
});
