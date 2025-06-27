Cypress.Commands.add('loginWiseApp', () => {
  cy.visit('/?account_id=1');
  cy.get('input[type="email"]').type('keven.mateus@fieldcorp.com.br');
  cy.contains('button', 'Verificar').click();
  // Aguarda o campo de e-mail sumir (autenticação concluída)
  cy.get('input[type="email"]', { timeout: 10000 }).should('not.exist');
}); 