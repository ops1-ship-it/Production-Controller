export type CountryCurrency = {
  countryCode: string;
  countryName: string;
  defaultCurrencyCode: string;
  currencyName: string;
  currencySymbol: string;
  defaultTimezone: string;
  locale: string;
  callingCode: string;
};

export const countryCurrencyOptions: CountryCurrency[] = [
  {
    countryCode: "ZA",
    countryName: "South Africa",
    defaultCurrencyCode: "ZAR",
    currencyName: "South African Rand",
    currencySymbol: "R",
    defaultTimezone: "Africa/Johannesburg",
    locale: "en-ZA",
    callingCode: "+27",
  },
  {
    countryCode: "US",
    countryName: "United States",
    defaultCurrencyCode: "USD",
    currencyName: "US Dollar",
    currencySymbol: "$",
    defaultTimezone: "America/New_York",
    locale: "en-US",
    callingCode: "+1",
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    defaultCurrencyCode: "GBP",
    currencyName: "Pound Sterling",
    currencySymbol: "£",
    defaultTimezone: "Europe/London",
    locale: "en-GB",
    callingCode: "+44",
  },
  {
    countryCode: "AU",
    countryName: "Australia",
    defaultCurrencyCode: "AUD",
    currencyName: "Australian Dollar",
    currencySymbol: "$",
    defaultTimezone: "Australia/Sydney",
    locale: "en-AU",
    callingCode: "+61",
  },
  {
    countryCode: "NZ",
    countryName: "New Zealand",
    defaultCurrencyCode: "NZD",
    currencyName: "New Zealand Dollar",
    currencySymbol: "$",
    defaultTimezone: "Pacific/Auckland",
    locale: "en-NZ",
    callingCode: "+64",
  },
  {
    countryCode: "CA",
    countryName: "Canada",
    defaultCurrencyCode: "CAD",
    currencyName: "Canadian Dollar",
    currencySymbol: "$",
    defaultTimezone: "America/Toronto",
    locale: "en-CA",
    callingCode: "+1",
  },
  {
    countryCode: "IE",
    countryName: "Ireland",
    defaultCurrencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    defaultTimezone: "Europe/Dublin",
    locale: "en-IE",
    callingCode: "+353",
  },
  {
    countryCode: "DE",
    countryName: "Germany",
    defaultCurrencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    defaultTimezone: "Europe/Berlin",
    locale: "de-DE",
    callingCode: "+49",
  },
  {
    countryCode: "FR",
    countryName: "France",
    defaultCurrencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    defaultTimezone: "Europe/Paris",
    locale: "fr-FR",
    callingCode: "+33",
  },
  {
    countryCode: "ES",
    countryName: "Spain",
    defaultCurrencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    defaultTimezone: "Europe/Madrid",
    locale: "es-ES",
    callingCode: "+34",
  },
  {
    countryCode: "IT",
    countryName: "Italy",
    defaultCurrencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    defaultTimezone: "Europe/Rome",
    locale: "it-IT",
    callingCode: "+39",
  },
  {
    countryCode: "NL",
    countryName: "Netherlands",
    defaultCurrencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    defaultTimezone: "Europe/Amsterdam",
    locale: "nl-NL",
    callingCode: "+31",
  },
  {
    countryCode: "BE",
    countryName: "Belgium",
    defaultCurrencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    defaultTimezone: "Europe/Brussels",
    locale: "nl-BE",
    callingCode: "+32",
  },
  {
    countryCode: "PT",
    countryName: "Portugal",
    defaultCurrencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    defaultTimezone: "Europe/Lisbon",
    locale: "pt-PT",
    callingCode: "+351",
  },
];

export const defaultCountryCurrency = countryCurrencyOptions[0];

export function countryByCode(countryCode: string) {
  return (
    countryCurrencyOptions.find(
      (country) => country.countryCode === countryCode.toUpperCase(),
    ) ?? defaultCountryCurrency
  );
}

export function countryByNameOrCode(value: string) {
  const normalised = value.trim().toLowerCase();
  return (
    countryCurrencyOptions.find(
      (country) =>
        country.countryCode.toLowerCase() === normalised ||
        country.countryName.toLowerCase() === normalised ||
        `${country.countryName} (${country.countryCode})`.toLowerCase() === normalised,
    ) ?? null
  );
}

export function currencyDisplay(country: CountryCurrency) {
  return `${country.defaultCurrencyCode} - ${country.currencyName} - ${country.currencySymbol}`;
}

export function countryInputLabel(country: CountryCurrency) {
  return `${country.countryName} (${country.countryCode})`;
}
