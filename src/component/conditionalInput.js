import React, { useState, useRef, useEffect } from 'react';

const DescriptionInputWithGhostText = ({ suggestions = [], placeholder = "Enter description..." }) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const inputRef = useRef(null);
  
  // Filter suggestions based on input
  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Handle input change
  const handleChange = (e) => {
    setInputValue(e.target.value);
    setShowSuggestion(e.target.value.length > 0);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
    setShowSuggestion(false);
    inputRef.current.focus();
  };

  // Handle key down events
  const handleKeyDown = (e) => {
    if (filteredSuggestions.length === 0) return;

    // Arrow down
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(prev => 
        prev === filteredSuggestions.length - 1 ? 0 : prev + 1
      );
    }
    // Arrow up
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(prev => 
        prev === 0 ? filteredSuggestions.length - 1 : prev - 1
      );
    }
    // Enter
    else if (e.key === 'Enter' && showSuggestion) {
      e.preventDefault();
      setInputValue(filteredSuggestions[activeSuggestion]);
      setShowSuggestion(false);
    }
  };

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestion(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative w-full max-w-md mx-auto my-5 font-sans" ref={inputRef}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 relative z-10 bg-transparent"
        />
        {/* Ghost text suggestion */}
        {inputValue.length > 0 && filteredSuggestions.length > 0 && (
          <div className="absolute top-0 left-0 px-3 py-2 text-base text-gray-400 pointer-events-none z-0 w-[calc(100%-24px)] whitespace-nowrap overflow-hidden">
            {filteredSuggestions[0].substring(0, inputValue.length)}
            <span className="opacity-50">
              {filteredSuggestions[0].substring(inputValue.length)}
            </span>
          </div>
        )}
      </div>
      
      {/* Suggestions dropdown */}
      {showSuggestion && filteredSuggestions.length > 0 && (
        <ul className="absolute w-full max-h-48 overflow-y-auto list-none p-0 m-0 border border-gray-300 border-t-0 rounded-b-md bg-white shadow-lg z-20">
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`px-3 py-2 cursor-pointer ${
                index === activeSuggestion ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Example usage
const App = () => {
  const suggestionExamples = [
    "This is a product description example",
    "This item is made from high-quality materials",
    "This product comes with a one-year warranty",
    "Available in multiple colors and sizes",
    "Easy to use and maintain",
    "Perfect for everyday use"
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Description Input with Ghost Text</h2>
      <DescriptionInputWithGhostText 
        suggestions={suggestionExamples} 
        placeholder="Start typing to see suggestions..."
      />
      <p className="mt-3 text-sm text-gray-500">
        Try typing "product" or "example" to see suggestions
      </p>
    </div>
  );
};

export default App;