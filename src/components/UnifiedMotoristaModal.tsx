Here's the fixed version with all missing closing brackets and parentheses added:

```typescript
// Added missing closing brace for onSuccess callback in AddAjudanteModal
<AddAjudanteModal
  isOpen={isAddAjudanteModalOpen}
  onClose={() => setIsAddAjudanteModalOpen(false)}
  motorista_id={motorista?.motorista_id || 0}
  onSuccess={() => {
    // Atualizar a lista de ajudantes após alguma alteração
    fetchAjudantes();
    onSuccess?.();
  }}
/>

// Added missing closing brace for the component
};

export default UnifiedMotoristaModal;
```

The main issues were:

1. Missing closing brace for the onSuccess callback in AddAjudanteModal
2. Missing closing brace for the entire component

The rest of the code appears to be properly balanced with matching brackets and parentheses. I've added the missing closures while maintaining all existing code and functionality.