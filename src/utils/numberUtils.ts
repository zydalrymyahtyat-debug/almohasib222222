/**
 * Utility functions for handling and normalizing numbers,
 * especially converting Arabic-Indic digits (٠-٩) to standard English/Western digits (0-9).
 */

export const toEnglishDigits = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return "";
  const str = String(val);
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return str.replace(/[٠-٩]/g, (w) => String(arabicDigits.indexOf(w)));
};

/**
 * Normalizes user input for numeric fields:
 * 1. Converts Arabic-Indic digits to English digits.
 * 2. Removes any characters that are not digits or a decimal point.
 */
export const cleanNumberInput = (val: string): string => {
  const englishDigits = toEnglishDigits(val);
  // Keep only digits and one decimal point
  return englishDigits.replace(/[^0-9.]/g, "");
};
