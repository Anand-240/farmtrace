import React from 'react';
import { stateSuggestions, getCitySuggestionsForState } from '../lib/locationSuggestions';
import { ChevronDown } from 'lucide-react';

export default function StateCitySelector({ stateValue, cityValue, onStateChange, onCityChange, required = true }) {
  const cities = getCitySuggestionsForState(stateValue);

  return (
    <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
      {/* State Dropdown */}
      <div style={{ flex: 1, position: 'relative' }}>
        <select
          className="ft-input"
          value={stateValue || ''}
          onChange={(e) => {
            onStateChange(e.target.value);
            onCityChange(''); // Reset city when state changes
          }}
          required={required}
          style={{ appearance: 'none', width: '100%' }}
        >
          <option value="" disabled>Select State / राज्य</option>
          {stateSuggestions.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
        <ChevronDown style={{ position: 'absolute', right: '1rem', top: '1.2rem', opacity: 0.5, pointerEvents: 'none' }} size={18} />
      </div>

      {/* City Dropdown */}
      <div style={{ flex: 1, position: 'relative' }}>
        <select
          className="ft-input"
          value={cityValue || ''}
          onChange={(e) => onCityChange(e.target.value)}
          required={required}
          disabled={!stateValue}
          style={{ appearance: 'none', width: '100%', opacity: !stateValue ? 0.6 : 1 }}
        >
          <option value="" disabled>{stateValue ? 'Select City / शहर' : 'Select State First'}</option>
          {cities.map((ct) => (
            <option key={ct} value={ct}>{ct}</option>
          ))}
        </select>
        <ChevronDown style={{ position: 'absolute', right: '1rem', top: '1.2rem', opacity: 0.5, pointerEvents: 'none' }} size={18} />
      </div>
    </div>
  );
}
