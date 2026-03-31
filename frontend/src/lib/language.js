import { createContext, useContext, useState } from 'react';

const LANGUAGE_STORAGE_KEY = 'farmtrace_language';

const translations = {
  hi: {
    common_lang: 'भाषा',
    common_hi: 'हिंदी',
    common_en: 'अंग्रेज़ी',

    login_badge: 'ट्रेसेबल सप्लाई चेन',
    login_subtitle: 'किसान से ग्राहक तक हर चरण को सत्यापित करें और भरोसा बनाएं।',
    login_mode_login: 'लॉगिन',
    login_mode_register: 'रजिस्टर',
    login_title_register: 'नया खाता बनाएं',
    login_title_login: 'वापस स्वागत है',
    login_copy_register: 'अपनी मूल जानकारी भरें या गूगल से तुरंत ऑनबोर्ड करें।',
    login_copy_login: 'अपने खाते में प्रवेश करें और डैशबोर्ड से काम जारी रखें।',
    login_name: 'पूरा नाम',
    login_role_farmer: 'किसान',
    login_role_distributor: 'वितरक',
    login_role_retailer: 'खुदरा विक्रेता',
    login_email: 'ईमेल पता',
    login_state_select: 'राज्य चुनें',
    login_city_select: 'शहर चुनें',
    login_city_select_first: 'पहले राज्य चुनें',
    login_village_select: 'गांव चुनें',
    login_village_select_first: 'पहले शहर चुनें',
    login_number_format: 'नंबर प्रारूप:',
    login_password: 'पासवर्ड',
    login_forgot_password: 'पासवर्ड भूल गए?',
    login_wait: 'कृपया प्रतीक्षा करें...',
    login_register_action: 'रजिस्टर करें',
    login_login_action: 'लॉगिन करें',
    login_or: 'या',
    login_google_missing: 'Google OAuth सक्षम करने के लिए REACT_APP_GOOGLE_CLIENT_ID सेट करें।',
    login_google_register_hint: 'गूगल से रजिस्टर करने पर यही भूमिका और स्थान विवरण सुरक्षित होंगे।',
    login_google_login_hint: 'मौजूदा गूगल खाते से सीधे लॉगिन कर सकते हैं।',
    login_have_account: 'क्या आपका पहले से खाता है?',
    login_new_user: 'क्या आप नए उपयोगकर्ता हैं?',

    dash_title: 'फार्मट्रेस कंट्रोल हब',
    dash_welcome: 'नमस्ते',
    dash_logout: 'लॉगआउट',
    dash_action_register: '+ नई फसल रजिस्टर करें',
    dash_action_transfer: 'ट्रांसफर अनुरोध भेजें',
    dash_action_pending: 'लंबित भुगतान',
    dash_action_history: 'इतिहास और सूचनाएं',
    dash_action_profile: 'प्रोफाइल संपादित करें',
    dash_action_ai: 'एआई सहायक',
    dash_stat_total_produce: 'कुल उत्पादन',
    dash_stat_pending_payments: 'लंबित भुगतान',
    dash_stat_unread: 'अपठित सूचनाएं',
    dash_stat_total_sales: 'कुल बिक्री',
    dash_filter_title: 'खोजें, फिल्टर करें और क्रमबद्ध करें',
    dash_filter_clear: 'साफ करें',
    dash_filter_search_placeholder: 'फसल, स्थान, ग्रेड खोजें...',
    dash_filter_all_status: 'सभी स्थिति',
    dash_filter_verified: 'सत्यापित',
    dash_filter_pending: 'लंबित',
    dash_filter_min_price: 'न्यूनतम मूल्य',
    dash_filter_max_price: 'अधिकतम मूल्य',
    dash_loading: 'लोड हो रहा है...',
    dash_empty_farmer: 'अभी कोई फसल रजिस्टर नहीं की गई है',
    dash_empty_farmer_sub: 'शुरुआत करने के लिए अपनी पहली फसल रजिस्टर करें।',
    dash_empty_register_cta: '+ उत्पादन रजिस्टर करें',
    dash_empty_filter: 'चुने गए फिल्टर के अनुसार कोई परिणाम नहीं मिला',
    dash_empty_received: 'अभी कोई उत्पादन प्राप्त नहीं हुआ',
    dash_empty_received_sub: 'भुगतान पूरा होने के बाद यहां दिखाई देगा।',
    dash_empty_transfer_cta: 'ट्रांसफर भेजें',
    dash_qr_title: 'क्यूआर कोड - स्कैन करें',
    dash_qr_sub: 'इस क्यूआर को स्कैन करने पर पूरी सप्लाई चेन यात्रा दिखाई देगी।',
    dash_close: 'बंद करें'
  },
  en: {
    common_lang: 'Language',
    common_hi: 'Hindi',
    common_en: 'English',

    login_badge: 'Traceable Supply Chain',
    login_subtitle: 'Verify every step from farmer to consumer and build trust.',
    login_mode_login: 'Login',
    login_mode_register: 'Register',
    login_title_register: 'Create New Account',
    login_title_login: 'Welcome Back',
    login_copy_register: 'Fill your basic profile or onboard instantly with Google.',
    login_copy_login: 'Access your account and continue from the dashboard.',
    login_name: 'Full Name',
    login_role_farmer: 'Farmer',
    login_role_distributor: 'Distributor',
    login_role_retailer: 'Retailer',
    login_email: 'Email Address',
    login_state_select: 'Select state',
    login_city_select: 'Select city',
    login_city_select_first: 'Select state first',
    login_village_select: 'Select village',
    login_village_select_first: 'Select city first',
    login_number_format: 'Number format:',
    login_password: 'Password',
    login_forgot_password: 'Forgot password?',
    login_wait: 'Please wait...',
    login_register_action: 'Register',
    login_login_action: 'Login',
    login_or: 'or',
    login_google_missing: 'Set REACT_APP_GOOGLE_CLIENT_ID to enable Google OAuth.',
    login_google_register_hint: 'Registering with Google will save the same role and location details.',
    login_google_login_hint: 'You can log in directly with your existing Google account.',
    login_have_account: 'Already have an account?',
    login_new_user: 'New user?',

    dash_title: 'FarmTrace Control Hub',
    dash_welcome: 'Hello',
    dash_logout: 'Logout',
    dash_action_register: '+ Register New Produce',
    dash_action_transfer: 'Send Transfer Request',
    dash_action_pending: 'Pending Payments',
    dash_action_history: 'History & Notifications',
    dash_action_profile: 'Edit Profile',
    dash_action_ai: 'AI Assistant',
    dash_stat_total_produce: 'Total Produce',
    dash_stat_pending_payments: 'Pending Payments',
    dash_stat_unread: 'Unread Notifications',
    dash_stat_total_sales: 'Total Sales',
    dash_filter_title: 'Search, Filter & Sort',
    dash_filter_clear: 'Clear',
    dash_filter_search_placeholder: 'Search crop, origin, grade...',
    dash_filter_all_status: 'All Status',
    dash_filter_verified: 'Verified',
    dash_filter_pending: 'Pending',
    dash_filter_min_price: 'Min price',
    dash_filter_max_price: 'Max price',
    dash_loading: 'Loading...',
    dash_empty_farmer: 'No produce registered yet',
    dash_empty_farmer_sub: 'Start by registering your first produce entry.',
    dash_empty_register_cta: '+ Register Produce',
    dash_empty_filter: 'No results found for the selected filters',
    dash_empty_received: 'No produce received yet',
    dash_empty_received_sub: 'You will see entries here after payment completion.',
    dash_empty_transfer_cta: 'Send Transfer',
    dash_qr_title: 'QR Code - Scan',
    dash_qr_sub: 'Scanning this QR shows the complete supply chain journey.',
    dash_close: 'Close'
  }
};

const LanguageContext = createContext({
  language: 'hi',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => key
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'en' || saved === 'hi' ? saved : 'hi';
  });

  const setLanguage = (nextLanguage) => {
    if (nextLanguage !== 'en' && nextLanguage !== 'hi') {
      return;
    }
    setLanguageState(nextLanguage);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'hi' ? 'en' : 'hi');
  };

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    t: (key) => translations[language]?.[key] || translations.hi[key] || key
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
