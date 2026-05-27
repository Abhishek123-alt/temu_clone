import { useEffect, useRef, useState } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguageStore, LANGUAGES } from '../../store/languageStore';

const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguageStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (code) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-full text-gray-700 hover:text-[#fb7701] hover:bg-gray-100 transition-colors"
      >
        <Globe size={20} />
        <span className="text-xs font-semibold uppercase hidden sm:inline">{current.code}</span>
        <ChevronDown size={14} className={`hidden sm:inline transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50"
        >
          {LANGUAGES.map((lang) => {
            const selected = lang.code === language;
            return (
              <li key={lang.code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-gray-50 ${
                    selected ? 'text-[#fb7701] font-semibold' : 'text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg leading-none" aria-hidden>{lang.flag}</span>
                    <span>{lang.nativeLabel}</span>
                  </span>
                  {selected && <Check size={16} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LanguageSwitcher;
