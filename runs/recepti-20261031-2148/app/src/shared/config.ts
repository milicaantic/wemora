/// <reference types="expo/types" />
// Expo tipovi daju `process`; ne zavisimo od toga da li neki drugi fajl uvozi expo-router.
// Adresa API-ja. Expo ubacuje EXPO_PUBLIC_* promenljive u kod pri buildu,
// ali samo ako se čitaju tačno ovako: process.env.EXPO_PUBLIC_API_URL.
// Bez nje: isti podrazumevani mock-api kao web original (Recepti: http://localhost:3000).
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
