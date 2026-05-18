import { createContext, useContext, useState } from 'react';

const Ctx = createContext({ counts: {}, setCounts: () => {} });

export function SidebarCountsProvider({ children }) {
  const [counts, setCounts] = useState({});
  return <Ctx.Provider value={{ counts, setCounts }}>{children}</Ctx.Provider>;
}

export const useSidebarCounts = () => useContext(Ctx);
