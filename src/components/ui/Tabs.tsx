import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

export const Tabs: React.FC<{ defaultValue: string; children: ReactNode }> = ({ defaultValue, children }) => {
  const [value, setValue] = useState(defaultValue);
  return <TabsContext.Provider value={{ value, setValue }}>{children}</TabsContext.Provider>;
};

export const TabsList: React.FC<{ children: ReactNode; className?: string }> = ({ children, className }) => (
  <div className={className}>{children}</div>
);

export const TabsTrigger: React.FC<{ value: string; children: ReactNode; className?: string }> = ({ value, children, className }) => {
  const ctx = useContext(TabsContext);
  if (!ctx) return null;
  const active = ctx.value === value;
  return (
    <button
      className={className + (active ? ' bg-primary text-primary-foreground' : '')}
      onClick={() => ctx.setValue(value)}
      type="button"
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<{ value: string; children: ReactNode; className?: string }> = ({ value, children, className }) => {
  const ctx = useContext(TabsContext);
  if (!ctx || ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
};

export default Tabs;
