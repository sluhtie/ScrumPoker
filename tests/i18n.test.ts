import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  savedLanguage,
  translate,
  errorText,
  LANGUAGES,
  messages,
  errorMessages,
  type Language,
  type MessageKey,
} from '../lib/i18n.ts';
void test('English is the fallback; German is explicit and dynamic values are preserved', () => {
  for (const value of [undefined, null, '', 'it', 'de-DE'])
    assert.equal(savedLanguage(value), 'en');
  assert.equal(savedLanguage('de'), 'de');
  assert.equal(
    translate('en', 'cardsCount', { votes: 2, total: 5 }),
    '2 / 5 cards',
  );
  assert.equal(
    translate('de', 'cardsCount', { votes: 2, total: 5 }),
    '2 / 5 Karten',
  );
  assert.equal(translate('en', 'estimateSaved', { value: 'XL' }), 'XL saved');
  assert.equal(
    errorText('de', 'HOST_ONLY'),
    'Diese Aktion ist nur für die Moderation verfügbar.',
  );
  assert.equal(
    errorText('en', 'HOST_ONLY'),
    'Only the host can perform this action.',
  );
  assert.equal(
    errorText('en', 'unknown internal exception'),
    'Could not connect. Please try again.',
  );
});

void test('all languages have complete messages and preserve translated placeholders', () => {
  for (const language of Object.keys(LANGUAGES) as Language[]) {
    assert.equal(savedLanguage(language), language);
    assert.deepEqual(
      Object.keys(messages[language]).sort(),
      Object.keys(messages.en).sort(),
    );
    for (const key of Object.keys(messages.en) as MessageKey[]) {
      assert.deepEqual(
        messages[language][key].match(/\{\w+\}/g)?.sort(),
        messages.en[key].match(/\{\w+\}/g)?.sort(),
        `${language}.${key}`,
      );
    }
    for (const translations of Object.values(errorMessages))
      assert.ok(translations[language]?.trim());
  }
  assert.equal(
    translate('es', 'cardsCount', { votes: 2, total: 5 }),
    '2 / 5 cartas',
  );
  assert.equal(
    translate('fr', 'cardsCount', { votes: 2, total: 5 }),
    '2 / 5 cartes',
  );
});
