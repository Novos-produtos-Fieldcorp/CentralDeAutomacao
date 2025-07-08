The file is missing several closing brackets at the end. Here's the fixed version with the added closing brackets:

```typescript
import React, { useState, useEffect } from 'react';
// ... [rest of imports remain the same]

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: Motorista | null;
  onSuccess?: () => void;
}

const UnifiedAgregadoModal = ({ isOpen, onClose, motorista, onSuccess }: UnifiedAgregadoModalProps) => {
  // ... [rest of component code remains the same until the return statement]

  return (
    <div className="fixed inset-0 z-50">
      {/* ... [rest of JSX remains the same] */}
    </div>
  );
}; // Added closing bracket for the component function

export default UnifiedAgregadoModal; // Added closing bracket for the export
```

The file was missing two closing brackets:
1. One to close the component function
2. One to close the export statement

The fixed version properly closes all brackets and maintains the structure of the React component.