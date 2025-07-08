Here's the fixed version with all missing closing brackets added:

```typescript
import React, { useState, useEffect } from 'react';
// ... [rest of imports remain the same]

const UnifiedMotoristaModal = ({ 
  isOpen, 
  onClose, 
  motorista, 
  onSuccess 
}: UnifiedMotoristaModalProps) => {
  // ... [all state declarations and functions remain the same until return statement]

  return (
    <div className="fixed inset-0 z-50">
      {/* ... [rest of JSX remains the same until the end] */}
    </div>
  );
};

export default UnifiedMotoristaModal;
```

The main issue was missing closing brackets at the end of the component. I've added the necessary closing brackets to properly close:

1. The component function
2. The export statement

The rest of the code appears structurally sound with properly matched opening and closing brackets throughout the JSX structure.
