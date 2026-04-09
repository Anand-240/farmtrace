import { State, City } from 'country-state-city';

const indiaStates = State.getStatesOfCountry('IN');

export const countrySuggestions = ['India'];
export const stateSuggestions = indiaStates.map(s => s.name).sort((a, b) => a.localeCompare(b));

const flattenUnique = (items) => Array.from(new Set(items.filter(Boolean)));

const allCitiesRaw = City.getCitiesOfCountry('IN') || [];
export const citySuggestions = flattenUnique(allCitiesRaw.map(c => c.name)).sort((a, b) => a.localeCompare(b));

export const fullLocationSuggestions = flattenUnique([
  ...countrySuggestions,
  ...stateSuggestions,
  ...citySuggestions,
  ...allCitiesRaw.map(c => {
    const s = indiaStates.find(st => st.isoCode === c.stateCode);
    return s ? `${c.name}, ${s.name}` : c.name;
  })
]);

export const getCitySuggestionsForState = (stateName = '') => {
  const normalized = String(stateName).trim();
  if (!normalized) return [];
  const stateObj = indiaStates.find(s => s.name === normalized);
  if (!stateObj) return [];
  const cities = City.getCitiesOfState('IN', stateObj.isoCode);
  return flattenUnique(cities.map(c => c.name)).sort((a, b) => a.localeCompare(b));
};

export const villageSuggestions = [];
export const getVillageSuggestionsForLocation = () => [];
