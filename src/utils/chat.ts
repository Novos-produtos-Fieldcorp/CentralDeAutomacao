export function initializeChat(phoneNumber: string) {
  if (typeof window !== 'undefined') {
    if ((window as any).userInChat) {
      (window as any).userInChat(phoneNumber);
    } else {
      console.error('Chat function not available. Make sure ChatProvider is mounted.');
    }
  }
}