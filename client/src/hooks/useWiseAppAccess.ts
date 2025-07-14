import { useContext } from 'react';
import { WiseAppAccessContext } from '../context/WiseAppAccessContext';

export const useWiseAppAccess = () => useContext(WiseAppAccessContext);