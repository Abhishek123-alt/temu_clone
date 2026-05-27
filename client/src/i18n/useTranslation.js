import { useLanguageStore } from '../store/languageStore';
import { TRANSLATIONS, DEFAULT_LANGUAGE } from './translations';

// {placeholder} interpolation. Missing keys fall back to English, then to the
// raw key — so a forgotten translation is loud rather than blank.
const interpolate = (template, params) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
};

export const useTranslation = () => {
  const language = useLanguageStore((state) => state.language);

  const t = (key, params) => {
    const bundle = TRANSLATIONS[language] || TRANSLATIONS[DEFAULT_LANGUAGE];
    const template = bundle[key] ?? TRANSLATIONS[DEFAULT_LANGUAGE][key] ?? key;
    return interpolate(template, params);
  };

  return { t, language };
};
