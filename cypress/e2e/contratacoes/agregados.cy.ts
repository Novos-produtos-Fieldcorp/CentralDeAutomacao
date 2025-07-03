/// <reference types="cypress" />

describe('Contratações - Agregados (Cobertura Completa)', () => {
  beforeEach(() => {
    cy.loginWiseApp();
    cy.visit('/?account_id=1');
    cy.contains('Contratações').click();
    cy.contains('Agregados').click();
  });

  it('deve exibir todos os filtros principais', () => {
    cy.get('input[placeholder*="Buscar"]').should('exist');
    cy.contains('Todos os status').should('exist');
    cy.contains('Todos os clientes').should('exist');
    cy.contains('Todas as cidades').should('exist');
    cy.contains('Todos os tipos').should('exist');
    cy.contains('Todos (Ativos/Inativos)').should('exist');
    cy.get('select').should('exist');
  });

  it('deve filtrar por status', () => {
    cy.contains('Todos os status').click();
    cy.contains('Cadastrado').click();
    cy.get('tbody tr').should('exist');
    cy.contains('Limpar').click();
  });

  it('deve filtrar por cliente', () => {
    cy.contains('Todos os clientes').click();
    cy.get('.max-h-48 input[type="checkbox"]').first().check({ force: true });
    cy.get('tbody tr').should('exist');
    cy.contains('Limpar').click();
  });

  it('deve filtrar por cidade', () => {
    cy.contains('Todas as cidades').click();
    cy.get('.max-h-48 input[type="checkbox"]').first().check({ force: true });
    cy.get('tbody tr').should('exist');
    cy.contains('Limpar').click();
  });

  it('deve filtrar por tipo de veículo', () => {
    cy.contains('Todos os tipos').click();
    cy.get('.max-h-48 input[type="checkbox"]').first().check({ force: true });
    cy.get('tbody tr').should('exist');
    cy.contains('Limpar').click();
  });

  it('deve filtrar por ativo/inativo', () => {
    cy.contains('Todos (Ativos/Inativos)').click();
    cy.contains('Somente Ativos').click();
    cy.get('tbody tr').should('exist');
    cy.contains('Todos (Ativos/Inativos)').click();
    cy.contains('Somente Inativos').click();
    cy.get('tbody tr').should('exist');
    cy.contains('Todos (Ativos/Inativos)').click();
    cy.contains('Todos (Ativos/Inativos)').click();
  });

  it('deve filtrar por período', () => {
    cy.get('select').select('Últimos 2 dias');
    cy.get('tbody tr').should('exist');
    cy.get('select').select('all');
  });

  it('deve buscar por nome/cpf/email/placa', () => {
    cy.get('input[placeholder*="Buscar"]').type('a');
    cy.get('tbody tr').should('exist');
    cy.get('input[placeholder*="Buscar"]').clear();
  });

  it('deve abrir e fechar o modal de adicionar agregado', () => {
    cy.get('button[aria-label="Adicionar novo agregado"]').click({ force: true });
    cy.contains('Cadastrar Agregado').should('exist');
    cy.get('button').contains('Cancelar').click({ force: true });
  });

  it('deve abrir e fechar o modal de edição', () => {
    cy.get('tbody tr').first().within(() => {
      cy.get('button[title="Editar Agregado"]').click({ force: true });
    });
    cy.contains('Editar Agregado').should('exist');
    cy.get('button').contains('Cancelar').click({ force: true });
  });

  it('deve abrir e fechar o modal de detalhes', () => {
    cy.get('tbody tr').first().within(() => {
      cy.get('button[title="Visualizar"]').click({ force: true });
    });
    cy.contains('Detalhes do Agregado').should('exist');
    cy.get('button').contains('Fechar').click({ force: true });
  });

  it('deve abrir e fechar o modal de upload de documento', () => {
    cy.get('tbody tr').first().within(() => {
      cy.get('button[title="Gerenciar Documentos"]').click({ force: true });
    });
    cy.contains('Enviar Documento').should('exist');
    cy.get('button').contains('Cancelar').click({ force: true });
  });

  it('deve selecionar todos e exibir ações em massa', () => {
    cy.get('input[type="checkbox"]').first().check({ force: true });
    cy.contains('Atualizar Status').should('exist');
    cy.contains('Atribuir Cliente').should('exist');
    cy.contains('Enviar Mensagem').should('exist');
    cy.contains('Excluir').should('exist');
    cy.get('input[type="checkbox"]').first().uncheck({ force: true });
  });

  it('deve exibir a paginação', () => {
    cy.contains('Próxima').should('exist');
    cy.contains('Anterior').should('exist');
  });

  it('deve abrir e fechar o modal de exclusão em massa', () => {
    cy.get('input[type="checkbox"]').first().check({ force: true });
    cy.contains('Excluir').click({ force: true });
    cy.contains('Confirmar Exclusão em Massa').should('exist');
    cy.get('button').contains('Cancelar').click({ force: true });
    cy.get('input[type="checkbox"]').first().uncheck({ force: true });
  });

  it('deve abrir e fechar o modal de mensagem em massa', () => {
    cy.get('input[type="checkbox"]').first().check({ force: true });
    cy.contains('Enviar Mensagem').click({ force: true });
    cy.contains('Enviar Mensagem em Massa').should('exist');
    cy.get('button').contains('Cancelar').click({ force: true });
    cy.get('input[type="checkbox"]').first().uncheck({ force: true });
  });
}); 