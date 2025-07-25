// cypress/support/commands.ts

import { TestMotoristaData } from './e2e';

// Custom command for login
Cypress.Commands.add('login', (accountId: string = '1') => {
  cy.visit(`/?account_id=${accountId}`);
  cy.wait(2000); // Wait for auth to complete
});

// Custom command to get elements by test ID
Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`);
});

// Custom command to visit contratação section
Cypress.Commands.add('visitContratacao', () => {
  cy.login();
  cy.get('[href="/motoristas"]').click();
  cy.url().should('include', '/motoristas');
  cy.waitForLoading();
});

// Custom command to wait for loading states
Cypress.Commands.add('waitForLoading', () => {
  // Wait for any loading spinners to disappear
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="loading-spinner"]').length > 0) {
      cy.get('[data-testid="loading-spinner"]', { timeout: 10000 }).should('not.exist');
    }
  });
  
  // Wait for table content to load
  cy.get('table tbody', { timeout: 10000 }).should('exist');
});

// Custom command to create test motorista
Cypress.Commands.add('createTestMotorista', (data?: Partial<TestMotoristaData>) => {
  const defaultData: TestMotoristaData = {
    nome: `Teste Motorista ${Date.now()}`,
    cpf: `${Math.random().toString().slice(2, 13)}`,
    telefone: `11${Math.random().toString().slice(2, 11)}`,
    email: `teste${Date.now()}@email.com`,
    funcao: 'Motorista',
    st_cadastro: 'cadastrado'
  };

  const motoristaData = { ...defaultData, ...data };

  // Click Add button
  cy.get('[data-testid="add-motorista-btn"]').click();
  
  // Fill form
  cy.get('[data-testid="nome-input"]').type(motoristaData.nome);
  cy.get('[data-testid="cpf-input"]').type(motoristaData.cpf);
  cy.get('[data-testid="telefone-input"]').type(motoristaData.telefone);
  
  if (motoristaData.email) {
    cy.get('[data-testid="email-input"]').type(motoristaData.email);
  }
  
  // Select function
  cy.get('[data-testid="funcao-select"]').click();
  cy.get(`[data-value="${motoristaData.funcao}"]`).click();
  
  // Submit form
  cy.get('[data-testid="submit-motorista-btn"]').click();
  
  // Wait for success message
  cy.contains('Motorista cadastrado com sucesso').should('be.visible');
  
  return cy.wrap(motoristaData);
});

// Custom command to clean up test data
Cypress.Commands.add('deleteTestData', () => {
  cy.window().then((win) => {
    // This would typically call an API endpoint to clean test data
    // For now, we'll implement a simple localStorage cleanup
    win.localStorage.clear();
  });
});

// Custom command to check table data
Cypress.Commands.add('checkTableData', (expectedData: any[]) => {
  cy.get('table tbody tr').should('have.length.at.least', expectedData.length);
  
  expectedData.forEach((item, index) => {
    cy.get('table tbody tr').eq(index).within(() => {
      if (item.nome) {
        cy.contains(item.nome).should('be.visible');
      }
      if (item.cpf) {
        cy.contains(item.cpf).should('be.visible');
      }
      if (item.funcao) {
        cy.contains(item.funcao).should('be.visible');
      }
    });
  });
});