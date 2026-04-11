import React from 'react';
import { ChevronDown } from 'lucide-react';

const MAJOR_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 
  'Uttarakhand', 'West Bengal', 'Delhi'
];

export default function StateCitySelector({ stateValue, cityValue, onStateChange, onCityChange, required = true }) {
  // Simple city fallback for now to ensure functionality
  const getCityFallback = (state) => {
    const list = {
      'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Meerut', 'Noida'],
      'Delhi': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
      'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda'],
      'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal'],
      'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik'],
      'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia'],
      'Rajasthan': ['Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer'],
      'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain'],
       'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar'],
       'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri']
    };
    return list[state] || ['Major City 1', 'Major City 2', 'Major City 3'];
  };

  const cities = stateValue ? getCityFallback(stateValue) : [];

  return (
    <div className="location-selector-wrap">
      {/* State Dropdown */}
      <div className="select-container">
        <select
          className="ft-input"
          value={stateValue || ''}
          onChange={(e) => {
            console.log('State Selected:', e.target.value);
            onStateChange(e.target.value);
            onCityChange(''); 
          }}
          required={required}
          style={{ width: '100%', cursor: 'pointer' }}
        >
          <option value="" disabled>Select State / राज्य</option>
          {MAJOR_STATES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      {/* City Dropdown */}
      <div className="select-container">
        <select
          className="ft-input"
          value={cityValue || ''}
          onChange={(e) => onCityChange(e.target.value)}
          required={required}
          disabled={!stateValue}
          style={{ width: '100%', opacity: !stateValue ? 0.6 : 1, cursor: stateValue ? 'pointer' : 'not-allowed' }}
        >
          <option value="" disabled>{stateValue ? 'Select City / शहर' : 'Select State First'}</option>
          {cities.map((ct) => (
            <option key={ct} value={ct}>{ct}</option>
          ))}
        </select>
      </div>

      <style>{`
        .location-selector-wrap {
          display: flex;
          gap: 1rem;
          width: 100%;
        }
        .select-container {
          flex: 1;
          position: relative;
        }
        .ft-input {
          /* Resetting any potential problematic styles */
          pointer-events: auto !important;
          z-index: 10;
        }
        @media (max-width: 600px) {
          .location-selector-wrap {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
