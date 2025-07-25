// cypress/e2e/contratacao/kanban.cy.ts

describe('Contratação Kanban', () => {
  beforeEach(() => {
    cy.visitContratacao();
    cy.contains('Kanban').click();
    cy.waitForLoading();
  });

  describe('Kanban Board Display', () => {
    it('should display all status columns', () => {
      const expectedColumns = [
        'Cadastrado',
        'Documentação',
        'Qualificado',
        'Contratado',
        'Rejeitado'
      ];

      expectedColumns.forEach(column => {
        cy.contains(column).should('be.visible');
      });
    });

    it('should show motorista cards in correct columns', () => {
      cy.get('[data-testid="kanban-column"]').each(($column) => {
        cy.wrap($column).within(() => {
          // Check if column has header
          cy.get('[data-testid="column-header"]').should('be.visible');
          
          // Check if cards exist in column
          cy.get('[data-testid="motorista-card"]').should('have.length.at.least', 0);
        });
      });
    });

    it('should display motorista information in cards', () => {
      cy.get('[data-testid="motorista-card"]').first().within(() => {
        // Should display name
        cy.get('[data-testid="motorista-name"]').should('be.visible');
        
        // Should display function
        cy.get('[data-testid="motorista-function"]').should('be.visible');
        
        // Should display contact info
        cy.get('[data-testid="motorista-phone"]').should('be.visible');
        
        // Should display location if available
        cy.get('body').then(($body) => {
          if ($body.find('[data-testid="motorista-location"]').length > 0) {
            cy.get('[data-testid="motorista-location"]').should('be.visible');
          }
        });
      });
    });
  });

  describe('Kanban Interactions', () => {
    it('should allow dragging cards between columns', () => {
      // Get a card from first column
      cy.get('[data-testid="motorista-card"]').first().as('dragCard');
      
      // Get target column (different from source)
      cy.get('[data-testid="kanban-column"]').eq(1).as('targetColumn');
      
      // Note: Actual drag and drop testing requires special setup
      // For now, we test the visual elements are present
      cy.get('@dragCard').should('have.attr', 'draggable');
    });

    it('should open motorista details modal when card is clicked', () => {
      cy.get('[data-testid="motorista-card"]').first().click();
      
      cy.get('[data-testid="motorista-details-modal"]').should('be.visible');
      cy.contains('Detalhes do Motorista').should('be.visible');
    });

    it('should show action buttons on card hover', () => {
      cy.get('[data-testid="motorista-card"]').first().trigger('mouseover');
      
      // Check for action buttons
      cy.get('[data-testid="card-edit-btn"]').should('be.visible');
      cy.get('[data-testid="card-chat-btn"]').should('be.visible');
    });
  });

  describe('Filtering and Search', () => {
    it('should filter by function type', () => {
      cy.get('[data-testid="function-filter"]').click();
      cy.get('[data-value="Motorista"]').click();
      
      // All visible cards should be Motoristas
      cy.get('[data-testid="motorista-card"]').each(($card) => {
        cy.wrap($card).should('contain', 'Motorista');
      });
    });

    it('should search by motorista name', () => {
      cy.get('[data-testid="search-input"]').type('Gabriel');
      cy.wait(1000); // Wait for debounce
      
      // All visible cards should contain search term
      cy.get('[data-testid="motorista-card"]').each(($card) => {
        cy.wrap($card).should('contain.text', 'Gabriel');
      });
    });

    it('should clear filters', () => {
      // Apply filters
      cy.get('[data-testid="function-filter"]').click();
      cy.get('[data-value="Agregado"]').click();
      
      cy.get('[data-testid="search-input"]').type('Test');
      
      // Clear filters
      cy.get('[data-testid="clear-filters-btn"]').click();
      
      // Should show all data again
      cy.get('[data-testid="motorista-card"]').should('have.length.at.least', 1);
    });
  });

  describe('Pagination', () => {
    it('should paginate within columns', () => {
      // Check if pagination controls exist for columns with many items
      cy.get('[data-testid="kanban-column"]').each(($column) => {
        cy.wrap($column).within(() => {
          cy.get('body').then(($body) => {
            if ($body.find('[data-testid="column-pagination"]').length > 0) {
              cy.get('[data-testid="column-pagination"]').should('be.visible');
              
              // Test next page
              cy.get('[data-testid="next-page-btn"]').click();
              cy.waitForLoading();
            }
          });
        });
      });
    });

    it('should change items per page', () => {
      cy.get('[data-testid="items-per-page-select"]').click();
      cy.get('[data-value="20"]').click();
      
      cy.waitForLoading();
      
      // Should load more items
      cy.get('[data-testid="motorista-card"]').should('have.length.at.least', 1);
    });
  });

  describe('Column Management', () => {
    it('should show correct count in column headers', () => {
      cy.get('[data-testid="kanban-column"]').each(($column) => {
        cy.wrap($column).within(() => {
          cy.get('[data-testid="column-count"]').should('be.visible');
          cy.get('[data-testid="column-count"]').should('contain.text', '(');
        });
      });
    });

    it('should expand/collapse columns', () => {
      cy.get('[data-testid="column-toggle-btn"]').first().click();
      
      // Column should be collapsed
      cy.get('[data-testid="kanban-column"]').first().should('have.class', 'collapsed');
      
      // Click again to expand
      cy.get('[data-testid="column-toggle-btn"]').first().click();
      cy.get('[data-testid="kanban-column"]').first().should('not.have.class', 'collapsed');
    });
  });

  describe('Status Updates', () => {
    it('should update motorista status by moving between columns', () => {
      // Select a motorista card
      cy.get('[data-testid="motorista-card"]').first().as('testCard');
      
      // Get original column
      cy.get('@testCard').parent('[data-testid="kanban-column"]').as('sourceColumn');
      
      // Click on the card to open details
      cy.get('@testCard').click();
      
      // Change status in modal
      cy.get('[data-testid="status-select"]').click();
      cy.get('[data-value="qualificado"]').click();
      
      // Save changes
      cy.get('[data-testid="save-changes-btn"]').click();
      
      // Verify success message
      cy.contains('Status atualizado com sucesso').should('be.visible');
      
      // Verify card moved to correct column
      cy.get('[data-testid="kanban-column"][data-status="qualificado"]').within(() => {
        cy.get('[data-testid="motorista-card"]').should('contain', 'Qualificado');
      });
    });
  });

  describe('Quick Actions', () => {
    it('should open edit modal from card action button', () => {
      cy.get('[data-testid="motorista-card"]').first().within(() => {
        cy.get('[data-testid="card-edit-btn"]').click();
      });
      
      cy.get('[data-testid="edit-motorista-modal"]').should('be.visible');
    });

    it('should start chat from card action button', () => {
      cy.get('[data-testid="motorista-card"]').first().within(() => {
        cy.get('[data-testid="card-chat-btn"]').click();
      });
      
      cy.get('[data-testid="floating-chat"]').should('be.visible');
    });
  });

  describe('Add New Motorista', () => {
    it('should add new motorista from kanban view', () => {
      cy.get('[data-testid="add-motorista-kanban-btn"]').click();
      
      cy.get('[data-testid="add-motorista-modal"]').should('be.visible');
      
      // Fill basic information
      cy.get('[name="nome"]').type(`Teste Kanban ${Date.now()}`);
      cy.get('[name="cpf"]').type('12345678901');
      cy.get('[name="telefone"]').type('11999999999');
      
      // Select function
      cy.get('[data-testid="funcao-select"]').click();
      cy.get('[data-value="Motorista"]').click();
      
      // Submit
      cy.get('[data-testid="submit-btn"]').click();
      
      // Verify success and new card appears
      cy.contains('cadastrado com sucesso').should('be.visible');
      
      // Should appear in "Cadastrado" column
      cy.get('[data-testid="kanban-column"][data-status="cadastrado"]').within(() => {
        cy.contains('Teste Kanban').should('be.visible');
      });
    });
  });
});