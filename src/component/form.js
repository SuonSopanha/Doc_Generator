"use client";
import { useState, useRef, useEffect } from "react";
import Autosuggest from "react-autosuggest";
import * as XLSX from 'xlsx';
import { FiUpload, FiFilter, FiDownload, FiX, FiCheck, FiCheckCircle, FiLock } from 'react-icons/fi';

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);

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
    setIsGenerating(true);

    if (!docFile || !excelFile) {
      alert("Please upload both DOC and Excel files.");
      setIsGenerating(false);
      return;
    }

    // Parse merging condition
    let mergingCondition = null;
    if (inputValue) {
      const [column, operator, value] = inputValue.split(" ");
      if (column && operator && value) {
        mergingCondition = {
          column,
          operator,
          value
        };
      }
    }

    const formData = new FormData();
    formData.append("docFile", docFile);
    formData.append("excelFile", excelFile);
    formData.append("outputFormat", outputFormat);
    formData.append("outputExtension", outputExtension);
    formData.append("password", password);
    formData.append("filterType", filterType);
    formData.append("customFrom", customRange.from);
    formData.append("customTo", customRange.to);
    
    // Add merging condition if it exists
    if (mergingCondition) {
      formData.append("mergingCondition", JSON.stringify(mergingCondition));
    }

    try {
      const response = await fetch("http://localhost:4000/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the blob directly from the response
      const blob = await response.blob();
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      setDownloadLink(url);
      setIsGenerated(true);
    } catch (error) {
      console.error('Error generating document:', error);
      alert('Failed to generate document. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Function to handle the download and cleanup
  const handleDownload = async () => {
    if (!downloadLink) return;

    try {
      // Create an invisible anchor element
      const a = document.createElement('a');
      a.href = downloadLink;
      a.download = `documents-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Cleanup the blob URL after download starts
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadLink);
        setDownloadLink(null);
        setIsGenerated(false);
      }, 100);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    }
  };

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
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-white text-xl font-semibold">Document Merge Tool</h2>
          <p className="text-blue-100 text-sm mt-1">Upload your documents and configure merge settings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          {/* File Upload Section */}
          <div className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Word Document
              </label>
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 transition-all hover:border-blue-500 group">
                <input
                  type="file"
                  accept=".doc,.docx"
                  onChange={(e) => setDocFile(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="text-center">
                  <FiUpload className="mx-auto h-8 w-8 text-gray-400 group-hover:text-blue-500" />
                  <p className="mt-2 text-sm text-gray-500 group-hover:text-blue-600">
                    {docFile ? docFile.name : "Drop your Word document here or click to browse"}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Excel Data Source
              </label>
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 transition-all hover:border-blue-500 group">
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv"
                  onChange={handleExcelFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="text-center">
                  <FiUpload className="mx-auto h-8 w-8 text-gray-400 group-hover:text-blue-500" />
                  <p className="mt-2 text-sm text-gray-500 group-hover:text-blue-600">
                    {excelFile ? excelFile.name : "Drop your Excel file here or click to browse"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Section */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Output Format
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setOutputFormat("single")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    outputFormat === "single"
                      ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                      : "bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200"
                  }`}
                >
                  Single Document
                </button>
                <button
                  onClick={() => setOutputFormat("multiple")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    outputFormat === "multiple"
                      ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                      : "bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200"
                  }`}
                >
                  Multiple Documents
                </button>
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Password (Optional)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password || ''}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to protect documents"
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pl-10"
                />
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                {password && (
                  <button
                    onClick={() => setPassword(null)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for no password protection
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter Type
              </label>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {["all", "even", "odd", "custom"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                      filterType === type
                        ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                        : "bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {filterType === "custom" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={customRange.from}
                      onChange={(e) =>
                        setCustomRange({ ...customRange, from: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={customRange.to}
                      onChange={(e) =>
                        setCustomRange({ ...customRange, to: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                  />
                  {inputValue && (
                    <button
                      onClick={() => setInputValue("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Enhanced suggestions dropdown */}
                {showSuggestion && filteredSuggestions.length > 0 && (
                  <ul className="absolute w-full mt-1 max-h-48 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 divide-y divide-gray-100 z-20">
                    {filteredSuggestions.map((suggestion, index) => (
                      <li
                        key={suggestion}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`px-4 py-2 cursor-pointer text-sm flex items-center space-x-2 ${
                          index === activeSuggestion
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="flex-1">
                          {inputValue.split(" ").length > 1 
                            ? `${inputValue.split(" ").slice(0, -1).join(" ")} ${suggestion}`
                            : suggestion
                          }
                        </span>
                        {index === activeSuggestion && (
                          <FiCheck className="w-4 h-4 text-blue-500" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center">
                <FiFilter className="w-3 h-3 mr-1" />
                Format: column_name operator value (e.g., "email = john@example.com")
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={handleSubmit}
                disabled={!docFile || !excelFile || isGenerating}
                className={`w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                  docFile && excelFile && !isGenerating
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <FiDownload className="w-4 h-4" />
                    <span>Generate Documents</span>
                  </>
                )}
              </button>

              {/* Download Section */}
              {isGenerated && downloadLink && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center text-green-700 mb-2">
                    <FiCheckCircle className="w-5 h-5 mr-2" />
                    <span className="font-medium">Generation Complete!</span>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-all"
                  >
                    <FiDownload className="w-4 h-4" />
                    <span>Download Generated Files</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Form;
