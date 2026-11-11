import CryptoJS from 'crypto-js';

/**
 * Cripta un messaggio di testo o didascalia prima dell'invio al database (E2EE).
 */
export const encryptMessage = (text: string, roomSecret: string): string => {
  if (!text) return '';
  try {
    return CryptoJS.AES.encrypt(text, roomSecret || 'DEFAULT_SECURE_KEY').toString();
  } catch (error) {
    console.error('Errore di crittografia E2EE:', error);
    return text;
  }
};

/**
 * Decripta un messaggio cifrato dal database con blocco try-catch anti-crash.
 * Se fallisce o il testo è in chiaro, restituisce il testo originale.
 */
export const decryptMessage = (cipherText: string, roomSecret: string): string => {
  if (!cipherText) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, roomSecret || 'DEFAULT_SECURE_KEY');
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    
    // Se la decriptazione è vuota, probabilmente era testo in chiaro
    if (!originalText) return cipherText; 
    
    return originalText;
  } catch (error) {
    console.warn('Decriptazione E2EE fallita, fallback al testo originale:', error);
    return cipherText;
  }
};
