The file appears to be missing a closing curly brace `}` for the first div in the JSX return statement. Here's the fixed version with the missing brace added:

```jsx
// ... rest of the code remains the same until the return statement

return (
  <div className="space-y-6">
    <div className="bg-white dark:bg-[#1B1F2B] p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
      <div className="bg-white dark:bg-[#1E2332] p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        {/* ... rest of the content ... */}
      </div>
    </div> {/* Added missing closing brace here */}

    {/* ... rest of the code remains the same ... */}
  </div>
);
```

The issue was that there was an extra opening div without a corresponding closing div. The fix adds the missing closing brace to properly close the nested div structure. The rest of the code remains unchanged.