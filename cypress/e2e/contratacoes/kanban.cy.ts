/// <reference types="cypress" />

describe('Contratações - Kanban', () => {
  beforeEach(() => {
    cy.loginWiseApp();
    cy.visit('/?account_id=1#/motoristas/kanban');
  });

  it('deve exibir as colunas do kanban', () => {
    const colunas = ['Cadastrado', 'Qualificado', 'Documentação', 'Gestão de Risco', 'Contrato Enviado', 'Contratado', 'Repescagem', 'Rejeitado'];
    colunas.forEach(coluna => {
      cy.contains(coluna).should('exist');
    });
  });

  it('deve exibir pelo menos um card em alguma coluna (se houver dados)', () => {
    cy.get('[class*=kanban]').find('[class*=card], [class*=item]').should('exist');
  });

  it('deve exibir o campo de busca', () => {
    cy.get('input[placeholder*="Buscar"]').should('exist');
  });
}); 