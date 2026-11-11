import CryptoJS from 'crypto-js';

// Cripta il messaggio prima di inviarlo al database
export const encryptMessage = (text: string, roomSecret: string): string => {
  try {
    return CryptoJS.AES.encrypt(text, roomSecret).toString();
  } catch (error) {
    console.error('Errore di crittografia:', error);
    return text;
  }
};

// Decripta il messaggio appena scaricato dal database
export const decryptMessage = (cipherText: string, roomSecret: string): string => {
  if (!cipherText) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, roomSecret);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    
    // Se decriptato ma vuoto, probabilmente era testo normale
    if (!decryptedText) return cipherText; 
    
    return decryptedText;
  } catch (error) {
    console.warn("Errore di decriptazione, mostro testo grezzo:", error);
    return cipherText; // Fallback al testo originale
  }
};