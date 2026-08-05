import { describe, it, expect } from 'vitest';
import { toEnglishDigits, cleanNumberInput } from './numberUtils';

describe('numberUtils', () => {
  describe('toEnglishDigits', () => {
    it('should return empty string for null or undefined', () => {
      expect(toEnglishDigits(null)).toBe('');
      expect(toEnglishDigits(undefined)).toBe('');
    });

    it('should convert standard English numbers to strings', () => {
      expect(toEnglishDigits(123)).toBe('123');
      expect(toEnglishDigits(0)).toBe('0');
      expect(toEnglishDigits('456')).toBe('456');
    });

    it('should convert Arabic-Indic digits to English digits', () => {
      expect(toEnglishDigits('١٢٣')).toBe('123');
      expect(toEnglishDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    });

    it('should handle mixed Arabic-Indic and English digits', () => {
      expect(toEnglishDigits('١٢34٥')).toBe('12345');
    });

    it('should preserve other characters in the string', () => {
      expect(toEnglishDigits('hello ١٢٣ world')).toBe('hello 123 world');
      expect(toEnglishDigits('١٢.٣٤')).toBe('12.34');
    });
  });

  describe('cleanNumberInput', () => {
    it('should convert Arabic-Indic digits to English and return digits', () => {
      expect(cleanNumberInput('١٢٣')).toBe('123');
      expect(cleanNumberInput('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    });

    it('should preserve English digits', () => {
      expect(cleanNumberInput('123')).toBe('123');
    });

    it('should keep digits and decimal points', () => {
      expect(cleanNumberInput('١٢.٣٤')).toBe('12.34');
      expect(cleanNumberInput('12.34')).toBe('12.34');
    });

    it('should remove any non-digit and non-decimal characters', () => {
      expect(cleanNumberInput('abc١٢٣def')).toBe('123');
      expect(cleanNumberInput('a1b2.c3')).toBe('12.3');
      expect(cleanNumberInput(' - ١٢٣.٤٥ $ ')).toBe('123.45');
    });
  });
});
