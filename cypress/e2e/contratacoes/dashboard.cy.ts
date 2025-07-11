/// <reference types="cypress" />

describe('Contratações - Dashboard', () => {
  beforeEach(() => {
    cy.loginWiseApp();
    cy.visit('/?account_id=1#/motoristas/dashboard');
  });

  it('deve exibir cards de estatísticas', () => {
    const cards = ['Motoristas', 'Agregados', 'Documentação', 'Qualificados', 'Contratos Ativos', 'Rejeitados'];
    cards.forEach(card => {
      cy.contains(card).should('exist');
    });
  });

  it('deve exibir clientes contratados (se houver)', () => {
    cy.contains('Clientes Contratados').should('exist');
  });

  it('deve exibir botões de filtro, exportação e navegação se existirem', () => {
    cy.contains('Filtrar').should('exist');
    cy.contains('Exportar').should('exist');
    cy.contains('Imprimir').should('exist');
    cy.contains('Próxima').should('exist');
    cy.contains('Anterior').should('exist');
  });

  it('deve executar ação rápida em um card se existir', () => {
    cy.get('.card').first().within(() => {
      cy.get('button').first().click({ force: true });
    });
    // Verifique se um modal ou ação foi disparada
  });
}); 