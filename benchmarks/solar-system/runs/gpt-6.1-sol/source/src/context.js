import {createContext,useContext} from 'react';
export const ObservatoryContext=createContext(null);
export const useObservatory=()=>useContext(ObservatoryContext);
