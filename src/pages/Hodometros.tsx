Here's the fixed version with all missing closing brackets added:

```typescript
// ... [previous code remains the same until the Clientes component]

const Clientes = () => {
    // ... [component code remains the same until return statement]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-400
                              dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent
                              font-display tracking-tight relative">
                    Clientes
                </h1> {/* Added missing closing tag */}
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-400
                              dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent">
                    Clientes
                </h1>
                <div className="flex gap-2">
                    {selectedItems.size > 0 && (
                        <button
                            onClick={() => setIsBulkDeleteModalOpen(true)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
                                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 
                                    transition-colors flex items-center gap-2"
                        >
                            <X size={16} />
                            Excluir Selecionados
                        </button>
                    )}
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                transition-colors flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Novo Cliente
                    </button>
                </div>
            </div>

            {/* ... [rest of the component remains the same] ... */}
        </div>
    );
};

export default Clientes;
```

The main issues were:
1. Missing closing tag for the first `<h1>` element
2. Duplicate `<h1>` element that needed proper closing
3. Proper nesting of the header section elements

The rest of the component's code appears to be properly structured with matching closing brackets.