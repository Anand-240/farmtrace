import { locationData } from '../data/locationData';

export const countrySuggestions = [
  'India',
  'United States',
  'United Arab Emirates',
  'United Kingdom',
  'Canada',
  'Australia',
  'Singapore',
  'Saudi Arabia'
];

export const stateSuggestions = Object.keys(locationData);

const flattenUnique = (items) => Array.from(new Set(items.filter(Boolean)));

export const citySuggestions = flattenUnique(
  Object.values(locationData).flatMap((cities) => Object.keys(cities || {}))
);

export const villageSuggestions = flattenUnique(
  Object.values(locationData).flatMap((cities) =>
    Object.values(cities || {}).flatMap((villages) => villages || [])
  )
);

export const fullLocationSuggestions = flattenUnique([
  ...countrySuggestions,
  ...stateSuggestions,
  ...citySuggestions,
  ...villageSuggestions,
  ...stateSuggestions.flatMap((state) =>
    Object.keys(locationData[state] || {}).map((city) => `${city}, ${state}`)
  ),
  ...stateSuggestions.flatMap((state) =>
    Object.entries(locationData[state] || {}).flatMap(([city, villages]) =>
      (villages || []).map((village) => `${village}, ${city}, ${state}`)
    )
  )
]);

export const getCitySuggestionsForState = (state = '') => {
  const normalized = String(state).trim();
  if (!normalized) return citySuggestions;
  return Object.keys(locationData[normalized] || {});
};

export const getVillageSuggestionsForLocation = (state = '', city = '') => {
  const normalizedState = String(state).trim();
  const normalizedCity = String(city).trim();
  if (!normalizedState || !normalizedCity) return villageSuggestions;
  return locationData[normalizedState]?.[normalizedCity] || villageSuggestions;
};
