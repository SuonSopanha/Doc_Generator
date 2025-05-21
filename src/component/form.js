"use client";
import { useState, useRef, useEffect } from "react";
import Autosuggest from "react-autosuggest";
import * as XLSX from "xlsx";
import {
  FiUpload,
  FiFilter,
  FiDownload,
  FiX,
  FiCheck,
  FiCheckCircle,
  FiLock,
  FiEye,
  FiX as FiClose,
} from "react-icons/fi";
import { renderAsync } from "docx-preview";

// Initialize suggestion sets with default values
const defaultSuggestionSets = [
  [], // First word suggestions (column names from Excel)
  ["=", "!=", ">", "<", ">=", "<=", "contains", "in", "between", "like"], // Second word suggestions (operators)
  [], // Third word suggestions (values - will be populated from Excel)
  ["and", "or"], // Fourth word suggestions (logical operators)
];

// Helper function to parse complex conditions
const parseConditions = (input) => {
  if (!input) return [];

  const conditions = [];
  let currentCondition = [];
  const tokens = input.split(" ");

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].toLowerCase();

    if (token === "and" || token === "or") {
      if (currentCondition.length > 0) {
        conditions.push(currentCondition.join(" "));
        conditions.push(token);
        currentCondition = [];
      }
    } else {
      currentCondition.push(tokens[i]);

      // Special handling for 'between' operator which needs two values
      if (
        currentCondition.length >= 2 &&
        currentCondition[1].toLowerCase() === "between"
      ) {
        if (currentCondition.length === 4) {
          // column between value1 value2
          conditions.push(currentCondition.join(" "));
          currentCondition = [];
        }
      }
      // Special handling for 'in' operator
      else if (
        currentCondition.length >= 2 &&
        currentCondition[1].toLowerCase() === "in"
      ) {
        const restOfInput = tokens.slice(i + 1).join(" ");
        const commaIndex = restOfInput.indexOf(",");
        if (commaIndex !== -1) {
          const values = restOfInput.split(",");
          currentCondition.push(values.join(","));
          conditions.push(currentCondition.join(" "));
          currentCondition = [];
          i += values.length;
        }
      }
      // Normal operators
      else if (currentCondition.length === 3) {
        conditions.push(currentCondition.join(" "));
        currentCondition = [];
      }
    }
  }

  if (currentCondition.length > 0) {
    conditions.push(currentCondition.join(" "));
  }

  return conditions;
};

const Form = () => {
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
  const [availableSheets, setAvailableSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const inputRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Handle adding a new condition
  const addCondition = () => {
    if (currentCondition.trim()) {
      setConditions([...conditions, currentCondition.trim()]);
      setCurrentCondition("");
    }
  };

  // Handle removing a condition
  const removeCondition = (index) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    setConditions(newConditions);
  };

  // Function to evaluate complex conditions
  const evaluateConditions = (row) => {
    return conditions.reduce((result, condition, index) => {
      const parts = condition.split(" ");
      const [column, operator, ...values] = parts;
      const value = row[column];

      let conditionResult;
      switch (operator.toLowerCase()) {
        case "contains":
          conditionResult = String(value)
            .toLowerCase()
            .includes(String(values[0]).toLowerCase());
          break;
        case "in":
          const valueList = values
            .join(" ")
            .split(",")
            .map((v) => v.trim());
          conditionResult = valueList.includes(String(value));
          break;
        case "between":
          const [min, max] = values;
          conditionResult = value >= min && value <= max;
          break;
        case "like":
          const pattern = new RegExp(values[0].replace(/%/g, ".*"), "i");
          conditionResult = pattern.test(String(value));
          break;
        case "=":
          conditionResult = value === values[0];
          break;
        case "!=":
          conditionResult = value !== values[0];
          break;
        case ">":
          conditionResult = value > values[0];
          break;
        case "<":
          conditionResult = value < values[0];
          break;
        case ">=":
          conditionResult = value >= values[0];
          break;
        case "<=":
          conditionResult = value <= values[0];
          break;
        default:
          conditionResult = true;
      }

      // If there's a logical operator before this condition
      if (index > 0) {
        const logicalOp = conditions[index - 1].split(" ").pop().toLowerCase();
        if (logicalOp === "and") {
          return result && conditionResult;
        } else if (logicalOp === "or") {
          return result || conditionResult;
        }
      }
      return conditionResult;
    }, true);
  };
  const [isGenerated, setIsGenerated] = useState(false);
  const previewContainerRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);

  // Function to read Excel/CSV/JSON file
  const readDataFile = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileExtension = file.name.split(".").pop().toLowerCase();
        let jsonData;
        let headers;
        let sheets = [];

        if (fileExtension === "xlsx" || fileExtension === "xls") {
          // Handle Excel file
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          // Get all sheet names
          sheets = workbook.SheetNames;
          setAvailableSheets(sheets);

          // If no sheet is selected, select the first one
          const sheetToUse = selectedSheet || sheets[0];
          setSelectedSheet(sheetToUse);

          // Read the selected sheet
          const worksheet = workbook.Sheets[sheetToUse];
          jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length > 0) {
            headers = Object.keys(jsonData[0]);
          }
        } else if (fileExtension === "json") {
          // Handle JSON file
          jsonData = JSON.parse(e.target.result);
          // If it's an array of objects, use the keys of the first object as headers
          if (Array.isArray(jsonData) && jsonData.length > 0) {
            headers = Object.keys(jsonData[0]);
          } else {
            throw new Error("JSON file must contain an array of objects");
          }
        } else if (fileExtension === "csv") {
          // Handle CSV file
          const csvText = e.target.result;
          const rows = csvText.split("\n").map((row) => row.split(","));
          headers = rows[0].map((header) => header.trim());
          jsonData = rows.slice(1).map((row) => {
            const obj = {};
            row.forEach((cell, index) => {
              obj[headers[index]] = cell.trim();
            });
            return obj;
          });
        } else {
          // Handle Excel file
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        }

        setExcelData(jsonData);

        // Update the suggestionSets with the headers
        setSuggestionSets((prev) => [
          headers || [], // First set is now the headers
          prev[1], // Keep the operators
          [], // Reset the values
        ]);
      } catch (error) {
        console.error("Error reading file:", error);
        alert(
          "Error reading file. Please make sure it's a valid Excel, CSV, or JSON file."
        );
      }
    };

    if (file.name.endsWith(".json") || file.name.endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDataFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setExcelFile(file);
      readDataFile(file);
    }
  };

  // Use effect to update value suggestions when selected column changes
  useEffect(() => {
    if (excelData && selectedColumn) {
      // Get unique values from the selected column
      const uniqueValues = [
        ...new Set(excelData.map((row) => String(row[selectedColumn]))),
      ];
      // Update the third suggestion set with column values
      setSuggestionSets((prev) => [
        prev[0], // Keep headers
        prev[1], // Keep operators
        uniqueValues, // Update values from selected column
      ]);
    }
  }, [selectedColumn, excelData]);

  // Enhanced getFilteredSuggestions function
  const getSuggestions = (value) => {
    const words = value.split(" ");
    const currentWordIndex = words.length - 1;
    const currentWord = words[currentWordIndex].toLowerCase();

    // Get suggestions based on the current position in the condition
    let currentSuggestions = [];
    
    // Show all column names if no input yet
    if (words.length === 1 && currentWord === "") {
      return suggestionSets[0] || [];
    }

    // Handle suggestions for each part of the condition
    if (words.length === 1) {
      // First word: Show filtered column names
      currentSuggestions = suggestionSets[0] || [];
    } else if (words.length === 2) {
      // Second word: Show operators
      currentSuggestions = suggestionSets[1] || [];
    } else if (words.length === 3) {
      // Third word: Show values for the selected column
      currentSuggestions = suggestionSets[2] || [];
    } else if (words.length > 3) {
      // After completing a condition: Show logical operators (and/or)
      const lastCompleteWord = words[words.length - 2].toLowerCase();
      if (!['and', 'or'].includes(lastCompleteWord)) {
        currentSuggestions = suggestionSets[3] || [];
      } else {
        // After 'and'/'or': Show column names again
        currentSuggestions = suggestionSets[0] || [];
      }
    }

    // Filter suggestions that start with the current word if there's input
    return currentWord.length > 0
      ? currentSuggestions.filter(suggestion => 
          suggestion.toLowerCase().startsWith(currentWord)
        )
      : currentSuggestions;
  };

  const filteredSuggestions = getSuggestions(inputValue);

  const handleSuggestionClick = (suggestion) => {
    const words = inputValue.split(" ");
    words[words.length - 1] = suggestion;
    const newValue =
      words.join(" ") + (words.length < suggestionSets.length ? " " : "");
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

    // Parse merging conditions
    let mergingConditions = [];
    if (inputValue) {
      const conditions = parseConditions(inputValue);
      mergingConditions = conditions
        .filter((condition) => condition !== "and" && condition !== "or")
        .map((condition) => {
          const parts = condition.split(" ");
          const [column, operator, ...values] = parts;
          let value;

          // Handle different operator types
          switch (operator.toLowerCase()) {
            case "between":
              value = values.join(" "); // Keep the range values together
              break;
            case "in":
              value = values
                .join(" ")
                .split(",")
                .map((v) => v.trim()); // Convert to array
              break;
            default:
              value = values.join(" ");
          }

          return {
            column,
            operator: operator.toLowerCase(),
            value,
            logicalOperator: conditions[conditions.indexOf(condition) + 1], // Get the next token if it's a logical operator
          };
        });
    }

    const formData = new FormData();
    formData.append("docFile", docFile);
    formData.append("excelFile", excelFile);
    if (selectedSheet) {
      formData.append("selectedSheet", selectedSheet);
    }
    formData.append("outputFormat", outputFormat);
    formData.append("outputExtension", outputExtension);
    formData.append("password", password);
    formData.append("filterType", filterType);
    formData.append("customFrom", customRange.from);
    formData.append("customTo", customRange.to);

    // Add merging conditions if they exist
    if (mergingConditions.length > 0) {
      formData.append("mergingConditions", JSON.stringify(mergingConditions));
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
      console.error("Error generating document:", error);
      alert("Failed to generate document. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Function to handle the download and cleanup
  const handleDownload = async () => {
    if (!downloadLink) return;

    try {
      // Create an invisible anchor element
      const a = document.createElement("a");
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
      console.error("Error downloading file:", error);
      alert("Failed to download file. Please try again.");
    }
  };

  const handleDocFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setDocFile(file);
      setShowPreview(false); // Reset preview when new file is uploaded
    }
  };

  const handlePreviewClick = async () => {
    if (showPreview) {
      // If preview is shown, hide it
      setShowPreview(false);
      if (previewContainerRef.current) {
        previewContainerRef.current.innerHTML = "";
      }
    } else {
      // If preview is hidden, show it
      if (!docFile) return;

      try {
        // Read the file as ArrayBuffer
        const arrayBuffer = await docFile.arrayBuffer();

        // Set preview to show first (important!)
        setShowPreview(true);

        // Wait for next render cycle
        setTimeout(async () => {
          if (previewContainerRef.current) {
            // Clear any existing content
            previewContainerRef.current.innerHTML = "";

            // Render the document
            await renderAsync(
              arrayBuffer,
              previewContainerRef.current,
              previewContainerRef.current,
              {
                className: "docx-preview",
                defaultFont: {
                  family: "Arial",
                  size: 11,
                },
                inWrapper: true,
                ignoreHeight: false,
                ignoreWidth: false,
                ignoreFonts: false,
                breakPages: true,
                debug: false,
              }
            );
          }
        }, 100); // Give enough time for the container to be ready
      } catch (error) {
        console.error("Error previewing document:", error);
        setShowPreview(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Show suggestions based on current input
    const words = newValue.split(" ");
    
    // Always show suggestions for the first word, even if empty
    if (words.length === 1) {
      setShowSuggestion(true);
    } else {
      const currentWord = words[words.length - 1];
      setShowSuggestion(currentWord !== undefined);
    }

    // Update selected column when first word is complete
    if (words.length >= 2 && words[0]) {
      const columnName = words[0].trim();
      if (suggestionSets[0].includes(columnName)) {
        setSelectedColumn(columnName);
      }
    }

    // Reset selected column when input is cleared
    if (!newValue) {
      setSelectedColumn(null);
    }
  };

  useEffect(() => {
    const previewContainer = previewContainerRef.current;
    return () => {
      if (previewContainer) {
        previewContainer.innerHTML = "";
      }
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6 h-[">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex flex-col space-y-4 w-full max-w-2xl mx-auto p-4">
          <h1 className="text-2xl font-bold text-center my-4">
            Document Generator
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 pb-24">
          {/* File Upload Section */}
          <div className="space-y-6">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Word Document
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg relative">
                <input
                  type="file"
                  accept=".doc,.docx"
                  onChange={handleDocFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="text-center">
                  <FiUpload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">
                      {docFile ? docFile.name : "Upload a Word document"}
                    </p>
                  </div>
                </div>
              </div>
              {docFile && (
                <div className="mt-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handlePreviewClick}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <FiEye className="mr-2" />
                    {showPreview ? "Hide Preview" : "View Preview"}
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Source
              </label>
              {/* Sheet selector */}
              {availableSheets.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Select Sheet
                  </label>
                  <select
                    value={selectedSheet || ""}
                    onChange={(e) => {
                      setSelectedSheet(e.target.value);
                      // Re-read the file with the new sheet
                      if (excelFile) {
                        readDataFile(excelFile);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {availableSheets.map((sheet) => (
                      <option key={sheet} value={sheet}>
                        {sheet}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 transition-all hover:border-blue-500 group">
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv,.json"
                  onChange={handleDataFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="text-center">
                  <FiUpload className="mx-auto h-8 w-8 text-gray-400 group-hover:text-blue-500" />
                  <p className="mt-2 text-sm text-gray-500 group-hover:text-blue-600">
                    {excelFile
                      ? excelFile.name
                      : "Drop your data file here (Excel, CSV, or JSON)"}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Supported formats: .xlsx, .xls, .csv, .json
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Section */}
          <div className="space-y-6">
            {/* Output Format Section */}
            <div>
              <div className="space-y-6">
                {/* Merge Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Merge Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {["single", "multiple"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setOutputFormat(type)}
                        className={`
                          px-4 py-3 rounded-lg text-sm font-medium transition-all
                          ${
                            outputFormat === type
                              ? "bg-blue-50 text-blue-700 border-2 border-blue-500"
                              : "bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-200 hover:bg-blue-50"
                          }
                        `}
                      >
                        {type === "single"
                          ? "Single Document"
                          : "Multiple Documents"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {outputFormat === "single"
                      ? "Combine all records into one document"
                      : "Generate separate document for each record"}
                  </p>
                </div>

                {/* File Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Output File Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: "docx", label: "Word (DOCX)" },
                      { value: "pdf", label: "PDF" },
                    ].map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setOutputExtension(type.value)}
                        className={`
                          px-4 py-3 rounded-lg text-sm font-medium transition-all
                          ${
                            outputExtension === type.value
                              ? "bg-blue-50 text-blue-700 border-2 border-blue-500"
                              : "bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-200 hover:bg-blue-50"
                          }
                        `}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {outputExtension === "docx"
                      ? "Editable document format compatible with Microsoft Word"
                      : "Universal document format, ideal for sharing and printing"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password (Optional)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password || ""}
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      From
                    </label>
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      To
                    </label>
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
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., name contains John and age between 25 30 or status in active,pending"
                  rows={3} // You can change to 2, 4, etc. as needed
                  className="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 resize-none"
                />

                {inputValue && (
                  <button
                    onClick={() => setInputValue("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                )}
                {showSuggestion && filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full h-[100px] mt-1">
                    <div
                      className="bg-white rounded-md shadow-lg border border-gray-200 overflow-y-auto"
                      style={{ maxHeight: "300px" }}
                    >
                      <ul className="py-1">
                        {filteredSuggestions.map((suggestion, index) => (
                          <li
                            key={suggestion}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                              index === activeSuggestion ? "bg-blue-50" : ""
                            }`}
                          >
                            {inputValue.split(" ").length > 1
                              ? `${inputValue
                                  .split(" ")
                                  .slice(0, -1)
                                  .join(" ")} ${suggestion}`
                              : suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 flex flex-row items-center">
                <FiFilter className="w-3 h-3 mr-1" />
                Format: column_name operator value (e.g., &quot;email =
                john@example.com&quot;)
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

        {/* Preview Modal */}
        {showPreview && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto"
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
          >
            {/* Background overlay */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-5xl">
                {/* Modal header */}
                <div className="bg-white px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    Document Preview
                  </h3>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={() => setShowPreview(false)}
                  >
                    <span className="sr-only">Close</span>
                    <FiClose className="h-6 w-6" />
                  </button>
                </div>

                {/* Modal content */}
                <div
                  className="bg-white"
                  style={{ height: "80vh", overflowY: "auto" }}
                >
                  <div
                    ref={previewContainerRef}
                    className="p-4 min-h-full"
                    style={{ minWidth: "800px" }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Form;
