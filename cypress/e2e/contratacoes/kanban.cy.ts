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

  it('deve filtrar por status', () => {
    cy.contains('Todos os status').click();
    cy.get('.dropdown-menu li').first().click();
    cy.get('[class*=kanban]').find('[class*=card], [class*=item]').should('exist');
    cy.contains('Limpar').click();
  });

  it('deve abrir e fechar o modal de adicionar motorista', () => {
    cy.contains('button', 'Adicionar Motorista').click();
    cy.contains('Cadastrar Motorista').should('exist');
    cy.get('button').contains('Cancelar').click();
  });

  it('deve abrir e fechar o modal de detalhes do card', () => {
    cy.get('[class*=kanban]').find('[class*=card], [class*=item]').first().click({ force: true });
    cy.contains('Detalhes do Motorista').should('exist');
    cy.get('button').contains('Fechar').click();
  });

  it('deve mover um card entre colunas (drag and drop)', () => {
    // Exemplo genérico, ajuste conforme a implementação do seu kanban
    cy.get('[class*=kanban]').find('[class*=card], [class*=item]').first().trigger('mousedown', { which: 1 });
    cy.get('[class*=kanban]').find('[class*=column]').eq(1).trigger('mousemove').trigger('mouseup', { force: true });
    // Verifique se o card foi movido, se possível
  });

  it('deve exibir botões de exportar e imprimir se existirem', () => {
    cy.contains('Exportar').should('exist');
    cy.contains('Imprimir').should('exist');
  });
}); 