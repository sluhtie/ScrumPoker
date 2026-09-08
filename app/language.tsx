'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Globe2, ChevronDown, Check } from 'lucide-react';
import { Menu } from '@base-ui/react/menu';
import {
  LANGUAGE_KEY,
  LANGUAGES,
  savedLanguage,
  translate,
  type Language,
  type MessageKey,
} from '../lib/i18n';
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (value: Language) => void;
}>({ language: 'en', setLanguage: () => {} });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>('en');
  useEffect(() => {
    let selected: Language = 'en';
    try {
      selected = savedLanguage(localStorage.getItem(LANGUAGE_KEY));
    } catch {
      /* Storage can be disabled. */
    }
    // Restore a device-local preference after the English server render.
    // oxlint-disable-next-line react/react-compiler
    updateLanguage(selected);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', translate(language, 'description'));
  }, [language]);
  function setLanguage(value: Language) {
    updateLanguage(value);
    try {
      localStorage.setItem(LANGUAGE_KEY, value);
    } catch {
      /* The in-session selection still works. */
    }
  }
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  return {
    ...context,
    t: (key: MessageKey, values?: Record<string, string | number>) =>
      translate(context.language, key, values),
  };
}
export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="language-selector">
      <Menu.Root>
        <Menu.Trigger className="language-trigger" aria-label={t('language')}>
          <Globe2 size={16} />
          <span className="language-name">{LANGUAGES[language]}</span>
          <span className="language-code">{language.toUpperCase()}</span>
          <ChevronDown className="language-chevron" size={14} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            align="end"
            sideOffset={8}
            className="language-positioner"
          >
            <Menu.Popup className="language-menu" aria-label={t('language')}>
              <Menu.RadioGroup
                value={language}
                onValueChange={(value) => setLanguage(savedLanguage(value))}
              >
                {Object.entries(LANGUAGES).map(([code, name]) => (
                  <Menu.RadioItem
                    className="language-option"
                    key={code}
                    value={code}
                    closeOnClick
                  >
                    <span className="language-option-code">
                      {code.toUpperCase()}
                    </span>
                    <span lang={code}>{name}</span>
                    <Menu.RadioItemIndicator className="language-check">
                      <Check size={15} />
                    </Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
