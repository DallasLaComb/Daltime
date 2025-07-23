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

    cy.get('#login-email').type(Cypress.env('TEST_EMAIL'));
    cy.get('#login-password').type(Cypress.env('TEST_PASSWORD'));
    cy.get('button[type="submit"]').click();

    // Wait for the request to complete and navigation to happen
    cy.wait(2000);

    // Check for manager dashboard redirect
    cy.url().should('include', '/manager/dashboard');
  });
});
