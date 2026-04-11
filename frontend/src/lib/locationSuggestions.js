import { State, City } from 'country-state-city';

const indiaStates = State.getStatesOfCountry('IN') || [];

const FALLBACK_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 
  'Uttarakhand', 'West Bengal', 'Delhi'
];

export const countrySuggestions = ['India'];
export const stateSuggestions = indiaStates.length > 0 
  ? indiaStates.map(s => s.name).sort((a, b) => a.localeCompare(b))
  : FALLBACK_STATES;

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

const FALLBACK_CITIES = ['Lucknow', 'Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Pune', 'Jaipur', 'Indore', 'Bhopal', 'Patna', 'Ranchi', 'Raipur', 'Chandigarh'];

export const getCitySuggestionsForState = (stateName = '') => {
  const normalized = String(stateName).trim();
  if (!normalized) return [];
  const stateObj = indiaStates.find(s => s.name === normalized);
  if (!stateObj) return FALLBACK_CITIES; // Return major cities if state not found
  const cities = City.getCitiesOfState('IN', stateObj.isoCode);
  return cities.length > 0 
    ? flattenUnique(cities.map(c => c.name)).sort((a, b) => a.localeCompare(b))
    : FALLBACK_CITIES;
};

export const villageSuggestions = [];
export const getVillageSuggestionsForLocation = () => [];
