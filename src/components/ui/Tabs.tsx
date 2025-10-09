import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({ defaultValue, value, onValueChange, children }) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = useMemo(() => value !== undefined, [value]);
  const currentValue = isControlled ? (value as string) : uncontrolledValue;

  const setValue = (next: string) => {
    if (!isControlled) {
      setUncontrolledValue(next);
    }
    onValueChange?.(next);
  };

  return <TabsContext.Provider value={{ value: currentValue, setValue }}>{children}</TabsContext.Provider>;
};

export const TabsList: React.FC<{ children: ReactNode; className?: string }> = ({ children, className }) => (
  <div className={className}>{children}</div>
);

export const TabsTrigger: React.FC<{ value: string; children: ReactNode; className?: string; 'data-testid'?: string }> = ({
  value,
  children,
  className,
  'data-testid': dataTestId,
}) => {
  const ctx = useContext(TabsContext);
  if (!ctx) return null;
  const active = ctx.value === value;
  return (
    <button
      className={cn(
        className,
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
      onClick={() => ctx.setValue(value)}
      type="button"
      data-testid={dataTestId}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<{
  value: string;
  children: ReactNode;
  className?: string;
  forceMount?: boolean;
}> = ({ value, children, className, forceMount = false }) => {
  const ctx = useContext(TabsContext);
  if (!ctx) return null;
  const isActive = ctx.value === value;
  if (!isActive && !forceMount) return null;
  return (
    <div className={cn(className, !isActive && 'hidden')} aria-hidden={!isActive}>
      {children}
    </div>
  );
};

export default Tabs;
