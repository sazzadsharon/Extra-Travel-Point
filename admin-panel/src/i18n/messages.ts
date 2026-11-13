export type AdminLocale = 'en' | 'bn';

export const ADMIN_MESSAGES: Record<AdminLocale, Record<string, string>> = {
  en: {
    language: 'Language',
    english: 'English',
    bangla: 'বাংলা',
    panelTitle: 'ETP Admin Panel',
    controlCenter: 'Extra Travel Point Control Center',
    phone: 'Phone number',
    password: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in...',
    adminCredentialsRequired: 'Please sign in with an admin account.',
    demoAdmin: 'Demo admin',
  },
  bn: {
    language: 'ভাষা',
    english: 'English',
    bangla: 'বাংলা',
    panelTitle: 'ETP অ্যাডমিন প্যানেল',
    controlCenter: 'Extra Travel Point পরিচালনা কেন্দ্র',
    phone: 'মোবাইল নম্বর',
    password: 'পাসওয়ার্ড',
    signIn: 'লগইন করুন',
    signingIn: 'লগইন হচ্ছে...',
    adminCredentialsRequired: 'অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করুন।',
    demoAdmin: 'ডেমো অ্যাডমিন',
  },
};
