import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    // Rimuoviamo il NavigationContainer da qui perché 
    // è già presente e gestito dentro AppNavigator!
    <AppNavigator />
  );
}