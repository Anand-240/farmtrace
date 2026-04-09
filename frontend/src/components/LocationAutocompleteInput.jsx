import { useId, useMemo } from 'react';

const normalize = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const scoreSuggestion = (suggestion, query) => {
  const normalizedSuggestion = normalize(suggestion);
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) return [0, normalizedSuggestion.length, normalizedSuggestion];
  if (normalizedSuggestion === normalizedQuery) return [0, normalizedSuggestion.length, normalizedSuggestion];
  if (normalizedSuggestion.startsWith(normalizedQuery)) return [1, normalizedSuggestion.length, normalizedSuggestion];

  const suggestionTokens = normalizedSuggestion.split(/[,\s]+/).filter(Boolean);
  if (suggestionTokens.some((token) => token.startsWith(normalizedQuery))) {
    return [2, normalizedSuggestion.length, normalizedSuggestion];
  }

  if (normalizedSuggestion.includes(normalizedQuery)) return [3, normalizedSuggestion.length, normalizedSuggestion];

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (queryTokens.length && queryTokens.every((token) => normalizedSuggestion.includes(token))) {
    return [4, normalizedSuggestion.length, normalizedSuggestion];
  }

  return [5, normalizedSuggestion.length, normalizedSuggestion];
};

export default function LocationAutocompleteInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Location daalo',
  className = '',
  inputStyle = {},
  listStyle = {},
  disabled = false,
  required = false,
  name,
  autoComplete = 'off',
  maxSuggestions = 24,
  spellCheck = false,
  onBlur,
  onFocus
}) {
  const listId = useId();

  const filteredSuggestions = useMemo(() => {
    const query = String(value || '');
    const unique = Array.from(new Set(suggestions.filter(Boolean)));
    const matched = unique
      .filter((item) => !query.trim() || normalize(item).includes(normalize(query)) || normalize(query).split(/\s+/).every((token) => normalize(item).includes(token)))
      .sort((a, b) => {
        const [scoreA, lengthA, valueA] = scoreSuggestion(a, query);
        const [scoreB, lengthB, valueB] = scoreSuggestion(b, query);
        if (scoreA !== scoreB) return scoreA - scoreB;
        if (lengthA !== lengthB) return lengthA - lengthB;
        return valueA.localeCompare(valueB);
      });

    return matched.slice(0, maxSuggestions);
  }, [value, suggestions, maxSuggestions]);

  return (
    <>
      <input
        name={name}
        list={listId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        style={inputStyle}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        onBlur={onBlur}
        onFocus={onFocus}
      />
      <datalist id={listId} style={listStyle}>
        {filteredSuggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </>
  );
}
