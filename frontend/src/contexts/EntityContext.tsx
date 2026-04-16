import { createContext, useContext, useState, ReactNode } from 'react';

export type EntityType = 'PERSONAL' | 'BUSINESS';

interface EntityContextType {
  activeEntities: Set<EntityType>;
  toggleEntity: (entity: EntityType) => void;
}

const EntityContext = createContext<EntityContextType | undefined>(undefined);

export function EntityProvider({ children }: { children: ReactNode }) {
  const [activeEntities, setActiveEntities] = useState<Set<EntityType>>(new Set(['PERSONAL']));

  const toggleEntity = (entity: EntityType) => {
    setActiveEntities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entity)) {
        if (newSet.size > 1) newSet.delete(entity); // Prevent tracking zero entities
      } else {
        newSet.add(entity);
      }
      return newSet;
    });
  };

  return (
    <EntityContext.Provider value={{ activeEntities, toggleEntity }}>
      {children}
    </EntityContext.Provider>
  );
}

export function useEntity() {
  const context = useContext(EntityContext);
  if (context === undefined) {
    throw new Error('useEntity must be used within an EntityProvider');
  }
  return context;
}
