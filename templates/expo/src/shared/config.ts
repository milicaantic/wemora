// Adresa API-ja. Expo ubacuje EXPO_PUBLIC_* promenljive u kod pri buildu,
// ali samo ako se čitaju tačno ovako: process.env.EXPO_PUBLIC_API_URL.
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? '';
