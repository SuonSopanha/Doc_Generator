"use client";
import { useState, useRef, useEffect } from "react";
import Autosuggest from "react-autosuggest";
import * as XLSX from 'xlsx';

// Initialize suggestion sets with default values
const defaultSuggestionSets = [
  [], // First word suggestions (column names from Excel)
  ["=", "!=", ">", "<", ">=", "<="], // Second word suggestions (operators)
  [], // Third word suggestions (values - will be populated from Excel)
];

const Form = () => {
  const [placeholders, setPlaceholders] = useState([""]);
  const [docFile, setDocFile] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const [outputFormat, setOutputFormat] = useState("single");
  const [outputExtension, setOutputExtension] = useState("docx");
  const [password, setPassword] = useState(null); // State for the password
  const [downloadLink, setDownloadLink] = useState(null); // State for the download link
  const [filterType, setFilterType] = useState("all"); // all, even, odd, custom
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [inputValue, setInputValue] = useState("");
  const [suggestedWord, setSuggestedWord] = useState([]);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [suggestionSets, setSuggestionSets] = useState(defaultSuggestionSets);
  const [excelData, setExcelData] = useState(null); // Store full Excel data
  const [selectedColumn, setSelectedColumn] = useState(null);
  const inputRef = useRef(null);

  // Function to read Excel file
  const readExcelFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        setExcelData(jsonData); // Store the full data
        
        // Update the suggestionSets with the headers
        setSuggestionSets(prev => [
          headers || [], // First set is now the Excel headers
          prev[1], // Keep the operators
          [], // Reset values set for now
        ]);
      } catch (error) {
        console.error('Error reading Excel file:', error);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Use effect to update value suggestions when selected column changes
  useEffect(() => {
    if (excelData && selectedColumn) {
      // Get unique values from the selected column
      const uniqueValues = [...new Set(excelData.map(row => String(row[selectedColumn])))];
      // Update the third suggestion set with column values
      setSuggestionSets(prev => [
        prev[0], // Keep headers
        prev[1], // Keep operators
        uniqueValues, // Update values from selected column
      ]);
    }
  }, [selectedColumn, excelData]);

  // Enhanced getFilteredSuggestions function
  const getFilteredSuggestions = (value) => {
    const words = value.split(" ");
    const currentWordIndex = words.length - 1;
    const currentWord = words[currentWordIndex].toLowerCase();
    
    // Get the appropriate suggestion set based on word position
    const currentSuggestions = suggestionSets[Math.min(currentWordIndex, 2)] || [];
    
    return currentSuggestions.filter(
      suggestion => suggestion.toLowerCase().includes(currentWord)
    );
  };

  const filteredSuggestions = getFilteredSuggestions(inputValue);

  const handleSuggestionClick = (suggestion) => {
    const words = inputValue.split(" ");
    words[words.length - 1] = suggestion;
    const newValue = words.join(" ") + (words.length < suggestionSets.length ? " " : "");
    setInputValue(newValue);
    setShowSuggestion(false);
    
    // Update selected column if we just selected the first word
    if (words.length === 1) {
      setSelectedColumn(suggestion);
    }
    
    inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (filteredSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((prev) =>
        prev === filteredSuggestions.length - 1 ? 0 : prev + 1
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((prev) =>
        prev === 0 ? filteredSuggestions.length - 1 : prev - 1
      );
    } else if (e.key === "Enter" && showSuggestion) {
      e.preventDefault();
      setInputValue(filteredSuggestions[activeSuggestion]);
      setShowSuggestion(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!docFile || !excelFile) {
      alert("Please upload both DOC and Excel files.");
      return;
    }

    const formData = new FormData();
    formData.append("docFile", docFile);
    formData.append("excelFile", excelFile);
    formData.append("outputFormat", outputFormat);
    formData.append("outputExtension", outputExtension);
    formData.append("password", password); // Append the password to form data
    formData.append("filterType", filterType);
    formData.append("customFrom", customRange.from);
    formData.append("customTo", customRange.to);

    console.log(formData);

    placeholders.forEach((placeholder, index) => {
      formData.append(`placeholder${index + 1}`, placeholder);
    });

    try {
      const response = await fetch("http://localhost:4000/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        setDownloadLink(url); // Set download link
        alert(
          "Files and placeholders uploaded successfully. Download available."
        );
      } else {
        alert("Failed to upload files.");
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    }
  };

  // Update Excel file handling
  const handleExcelFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setExcelFile(file);
      readExcelFile(file);
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowSuggestion(true);
    
    // Parse input to check for column selection
    const words = newValue.split(" ");
    if (words.length === 3) {
      setSelectedColumn(words[0]);
    }
    
    // Reset selected column when input is cleared
    if (!newValue) {
      setSelectedColumn(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-white shadow-lg rounded-lg w-full mx-auto">
      {/* Form Section */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-6 p-6 bg-white-50 rounded-lg"
      >
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          Auto Docx Generator
        </h2>

        <div className="w-full">
          <label className="text-sm font-medium text-gray-900 block mb-1">
            Upload DOC file
          </label>
          <input
            type="file"
            accept=".doc,.docx"
            className="w-full text-sm border border-gray-300 rounded-md file:mr-3 file:py-1 file:px-3 file:border-0 file:rounded-md file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
            onChange={(e) => setDocFile(e.target.files[0])}
          />
        </div>

        <div className="w-full">
          <label className="text-sm font-medium text-gray-900 block mb-1">
            Upload Excel file
          </label>
          <input
            type="file"
            accept=".xls,.xlsx,.csv,.json"
            className="w-full text-sm border border-gray-300 rounded-md file:mr-3 file:py-1 file:px-3 file:border-0 file:rounded-md file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
            onChange={handleExcelFileChange}
          />
        </div>

        <div className="w-full">
          <label className="text-sm font-medium text-gray-900 block mb-2">
            Output Extension
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="outputExtension"
                value="docx"
                checked={outputExtension === "docx"}
                onChange={(e) => setOutputExtension(e.target.value)}
                className="text-blue-800 border-gray-300 focus:ring-blue-800"
              />
              <span className="text-sm text-gray-700">DOCX</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="outputExtension"
                value="pdf"
                checked={outputExtension === "pdf"}
                onChange={(e) => setOutputExtension(e.target.value)}
                className="text-blue-800 border-gray-300 focus:ring-blue-800"
              />
              <span className="text-sm text-gray-700">PDF</span>
            </label>
          </div>
        </div>

        <div className="w-full">
          <label className="text-sm font-medium text-gray-900 block mb-2">
            Output Format
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="outputFormat"
                value="single"
                checked={outputFormat === "single"}
                onChange={(e) => setOutputFormat(e.target.value)}
                className="text-blue-800 border-gray-300 focus:ring-blue-800"
              />
              <span className="text-sm text-gray-700">Single</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="outputFormat"
                value="multiple"
                checked={outputFormat === "multiple"}
                onChange={(e) => setOutputFormat(e.target.value)}
                className="text-blue-800 border-gray-300 focus:ring-blue-800"
              />
              <span className="text-sm text-gray-700">Multiple</span>
            </label>
          </div>
        </div>

        <div className="w-full">
          <label className="text-sm font-medium text-gray-900 block mb-1">
            Password (Optional)
          </label>
          <input
            type="password"
            className="w-full text-sm border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="w-full">
          <label className="text-sm font-medium text-gray-900 block mb-1">
            Row Filter
          </label>
          <select
            className="w-full text-sm border border-gray-300 rounded-md py-2 px-3"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All</option>
            <option value="even">Even</option>
            <option value="odd">Odd</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {filterType === "custom" && (
          <div className="w-full flex gap-4">
            <div className="w-1/2">
              <label className="text-sm font-medium text-gray-900 block mb-1">
                From
              </label>
              <input
                type="number"
                className="w-full text-sm border border-gray-300 rounded-md py-2 px-3"
                value={customRange.from}
                onChange={(e) =>
                  setCustomRange({ ...customRange, from: e.target.value })
                }
              />
            </div>
            <div className="w-1/2">
              <label className="text-sm font-medium text-gray-900 block mb-1">
                To
              </label>
              <input
                type="number"
                className="w-full text-sm border border-gray-300 rounded-md py-2 px-3"
                value={customRange.to}
                onChange={(e) =>
                  setCustomRange({ ...customRange, to: e.target.value })
                }
              />
            </div>
          </div>
        )}

        <div className="w-full">
          <label className="text-sm font-medium text-gray-900 block mb-1">
            Merging Condition
          </label>
          <div className="relative" ref={inputRef}>
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="column operator value"
                className="w-full text-sm border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 relative z-10 bg-white"
              />
              {/* Ghost text suggestion */}
              {inputValue.length > 0 && filteredSuggestions.length > 0 && (
                <div className="absolute top-0 left-0 h-full flex items-center px-3 text-sm text-gray-400 pointer-events-none z-0 w-full">
                  <span className="invisible">{inputValue}</span>
                  <span className="absolute left-0 pl-3 text-gray-400 opacity-70">
                    {filteredSuggestions[0].substring(
                      inputValue.split(" ").pop().length
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Contextual suggestions dropdown */}
            {showSuggestion && filteredSuggestions.length > 0 && (
              <ul className="absolute w-full mt-1 max-h-48 overflow-y-auto list-none p-0 m-0 border border-gray-200 rounded-md bg-white shadow-lg z-20 divide-y divide-gray-100">
                {filteredSuggestions.map((suggestion, index) => (
                  <li
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`px-3 py-2 cursor-pointer text-sm ${
                      index === activeSuggestion
                        ? "bg-blue-50 text-blue-800"
                        : "hover:bg-gray-50 text-gray-700"
                    } transition-colors`}
                  >
                    {inputValue.split(" ").slice(0, -1).join(" ")} {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Format: column_name operator value (e.g., "email =
            example@test.com")
          </p>
        </div>

        <button
          type="submit"
          className="w-full py-2 mt-6 text-white font-semibold bg-blue-800 rounded-md hover:bg-blue-900 focus:outline-none"
        >
          Submit
        </button>
      </form>

      {/* Result Section */}
      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg text-center">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Result</h3>
        {downloadLink ? (
          <div>
            <p className="mb-4 text-gray-900">
              Your file is ready for download!
            </p>
            <a
              href={downloadLink}
              download={`generated-documents.${
                outputFormat === "docx" ? "zip" : "zip"
              }`}
              className=" text-white py-2 px-4 font-semibold bg-blue-800 rounded-md hover:bg-blue-900 focus:outline-none"
            >
              Download
            </a>
          </div>
        ) : (
          <p className="text-gray-900">No file generated yet.</p>
        )}
      </div>
    </div>
  );
};

export default Form;
