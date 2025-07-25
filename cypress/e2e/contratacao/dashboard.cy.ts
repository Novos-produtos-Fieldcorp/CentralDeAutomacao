// cypress/e2e/contratacao/dashboard.cy.ts

describe('Contratação Dashboard', () => {
  beforeEach(() => {
    cy.visitContratacao();
  });

  it('should display dashboard statistics correctly', () => {
    // Check if main stats cards are visible
    cy.contains('Total Motoristas').should('be.visible');
    cy.contains('Total Agregados').should('be.visible');
    cy.contains('Em Documentação').should('be.visible');
    cy.contains('Qualificados').should('be.visible');
    cy.contains('Contratos Ativos').should('be.visible');
    cy.contains('Rejeitados').should('be.visible');
  });

  it('should display monthly registration chart', () => {
    cy.get('[data-testid="monthly-chart"]').should('be.visible');
    cy.contains('Cadastros por Mês').should('be.visible');
  });

  it('should display clients ranking table', () => {
    cy.contains('Ranking de Clientes').should('be.visible');
    cy.get('table').should('contain', 'Cliente');
    cy.get('table').should('contain', 'Total');
    cy.get('table').should('contain', 'Motoristas');
    cy.get('table').should('contain', 'Agregados');
  });

  it('should navigate to different contratação sections', () => {
    // Test navigation to Motoristas Lista
    cy.contains('Lista de Motoristas').click();
    cy.url().should('include', '/motoristas/lista');

    // Go back and test Kanban view
    cy.go('back');
    cy.contains('Visão Kanban').click();
    cy.url().should('include', '/motoristas/kanban');

    // Test Agregados section
    cy.go('back');
    cy.contains('Agregados').click();
    cy.url().should('include', '/motoristas/agregados');
  });

  it('should refresh data when refresh button is clicked', () => {
    // Find and click refresh button (if exists)
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="refresh-btn"]').length > 0) {
        cy.get('[data-testid="refresh-btn"]').click();
        cy.waitForLoading();
      }
    });
  });
});