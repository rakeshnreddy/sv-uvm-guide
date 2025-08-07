"use client";

import React, { createContext, useContext, useState } from "react";

interface LocalizationContextType {
  locale: string;
  setLocale: (locale: string) => void;
}

export const LocalizationContext = createContext<LocalizationContextType>({
  locale: "en",
  setLocale: () => {},
});

export const LocalizationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [locale, setLocale] = useState("en");
  return (
    <LocalizationContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = () => useContext(LocalizationContext);

export default LocalizationProvider;
