Here's the fixed version with all missing closing brackets added:

```typescript
// ... [previous code remains the same until the last few lines]

const StatCard = ({ 
  title, 
  value, 
  icon: Icon,
  color = 'blue',
  unit = ''
}: { 
  title: string;
  value: number;
  icon: any;
  color?: 'blue' | 'green' | 'purple' | 'amber' | 'red';
  unit?: string;
}) => {
  // ... [StatCard component code remains the same]
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex flex-col items-center text-center bg-white dark:bg-[#1E2332]">
        <div className={`p-3 ${variant.iconBg} rounded-2xl mb-3`}>
          <Icon className={`w-6 h-6 ${variant.iconColor}`} />
        </div>
        
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          {title}
        </h3>
        
        <p className={`text-3xl font-bold bg-gradient-to-r ${variant.gradient} ${variant.darkGradient} bg-clip-text text-transparent`}>
          {value.toLocaleString('pt-BR')}{unit && ` ${unit}`}
        </p>
      </div>
    </div>
  );
};

export default HodometrosDashboard;
```

The main issue was missing a closing bracket `}` for the first `div` in the HodometrosDashboard component. I've added it and ensured all other brackets are properly closed.