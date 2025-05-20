import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface ChecklistState {
  items: Record<string, any>;
  unsavedChanges: boolean;
  lastSaved: string | null;
  isAutosaving: boolean;
  restoredSession: boolean;
}

type ChecklistAction = 
  | { type: 'UPDATE_ITEM'; payload: { id: string; data: any } }
  | { type: 'SET_SAVED'; payload: string }
  | { type: 'SET_AUTOSAVING'; payload: boolean }
  | { type: 'RESTORE_SESSION'; payload: any }
  | { type: 'CLEAR_SESSION' };

const STORAGE_KEY = 'checklist_session';
const AUTOSAVE_INTERVAL = 3000; // 3 seconds

const initialState: ChecklistState = {
  items: {},
  unsavedChanges: false,
  lastSaved: null,
  isAutosaving: false,
  restoredSession: false
};

const checklistReducer = (state: ChecklistState, action: ChecklistAction): ChecklistState => {
  switch (action.type) {
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: {
          ...state.items,
          [action.payload.id]: action.payload.data
        },
        unsavedChanges: true
      };
    case 'SET_SAVED':
      return {
        ...state,
        unsavedChanges: false,
        lastSaved: action.payload
      };
    case 'SET_AUTOSAVING':
      return {
        ...state,
        isAutosaving: action.payload
      };
    case 'RESTORE_SESSION':
      return {
        ...state,
        items: action.payload,
        restoredSession: true
      };
    case 'CLEAR_SESSION':
      return {
        ...initialState,
        restoredSession: true
      };
    default:
      return state;
  }
};

const ChecklistContext = createContext<{
  state: ChecklistState;
  updateItem: (id: string, data: any) => void;
  saveChanges: () => Promise<void>;
  clearSession: () => void;
} | null>(null);

export const ChecklistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(checklistReducer, initialState);

  // Load saved session from localStorage
  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEY);
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession);
        dispatch({ type: 'RESTORE_SESSION', payload: parsedSession });
        toast.success('Sessão anterior restaurada');
      } catch (error) {
        console.error('Error restoring session:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    if (state.unsavedChanges && !state.isAutosaving) {
      const timer = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
        dispatch({ type: 'SET_SAVED', payload: new Date().toISOString() });
        toast.success('Alterações salvas automaticamente', { id: 'autosave' });
      }, AUTOSAVE_INTERVAL);

      return () => clearTimeout(timer);
    }
  }, [state.items, state.unsavedChanges, state.isAutosaving]);

  // Prevent accidental navigation when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.unsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.unsavedChanges]);

  const updateItem = useCallback((id: string, data: any) => {
    dispatch({ type: 'UPDATE_ITEM', payload: { id, data } });
  }, []);

  const saveChanges = useCallback(async () => {
    if (!state.unsavedChanges) return;

    dispatch({ type: 'SET_AUTOSAVING', payload: true });
    try {
      // Save each item to Supabase
      const promises = Object.entries(state.items).map(async ([id, data]) => {
        const { error } = await supabase
          .from('checklist_item_response')
          .upsert({
            item_id: id,
            ...data,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
      });

      await Promise.all(promises);
      
      dispatch({ type: 'SET_SAVED', payload: new Date().toISOString() });
      toast.success('Todas as alterações foram salvas');
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      dispatch({ type: 'SET_AUTOSAVING', payload: false });
    }
  }, [state.unsavedChanges, state.items]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'CLEAR_SESSION' });
    toast.success('Sessão limpa com sucesso');
  }, []);

  return (
    <ChecklistContext.Provider value={{ state, updateItem, saveChanges, clearSession }}>
      {children}
    </ChecklistContext.Provider>
  );
};

const useChecklist = () => {
  const context = useContext(ChecklistContext);
  if (!context) {
    throw new Error('useChecklist must be used within a ChecklistProvider');
  }
  return context;
};