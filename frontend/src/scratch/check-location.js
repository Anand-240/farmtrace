const { State } = require('country-state-city');
const states = State.getStatesOfCountry('IN');
console.log('States Count:', states.length);
if (states.length > 0) {
    console.log('First 3 states:', states.slice(0, 3).map(s => s.name));
} else {
    console.log('No states found!');
}
