// cypress/support/e2e.ts

// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

declare global {
  namespace Cypress {
    interface Chainable {
      login(accountId?: string): Chainable<Element>
      getByTestId(testId: string): Chainable<Element>
      visitContratacao(): Chainable<Element>
      createTestMotorista(data?: Partial<TestMotoristaData>): Chainable<Element>
      deleteTestData(): Chainable<Element>
      waitForLoading(): Chainable<Element>
      checkTableData(expectedData: any[]): Chainable<Element>
    }
  }
}

export interface TestMotoristaData {
  nome: string;
  cpf: string;
  telefone: string;
  email?: string;
  funcao: 'Motorista' | 'Agregado';
  st_cadastro: 'cadastrado' | 'documentacao' | 'qualificado' | 'contratado' | 'rejeitado';
}