"use client";
import { useState, useRef, useEffect } from "react";
import Autosuggest from "react-autosuggest";
import * as XLSX from 'xlsx';
import { FiUpload, FiFilter, FiDownload, FiX, FiCheck, FiCheckCircle, FiLock, FiEye, FiX as FiClose } from 'react-icons/fi';
import { renderAsync } from 'docx-preview';

// Initialize suggestion sets with default values
const defaultSuggestionSets = [
  [], // First word suggestions (column names from Excel)
  ["=", "!=", ">", "<", ">=", "<="], // Second word suggestions (operators)
  [], // Third word suggestions (values - will be populated from Excel)
];

const Form = () => {
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); // e.g., 'queued', 'processing', 'completed', 'failed'
  const [jobError, setJobError] = useState(null);
  const [pollingIntervalId, setPollingIntervalId] = useState(null);
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
  const [isGenerated, setIsGenerated] = useState(false); // Will be set true when job polling confirms completion
  const previewContainerRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);

  // Function to read Excel/CSV/JSON file
  const readDataFile = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        let jsonData;
        let headers;

        if (fileExtension === 'json') {
          // Handle JSON file
          jsonData = JSON.parse(e.target.result);
          // If it's an array of objects, use the keys of the first object as headers
          if (Array.isArray(jsonData) && jsonData.length > 0) {
            headers = Object.keys(jsonData[0]);
          } else {
            throw new Error('JSON file must contain an array of objects');
          }
        } else if (fileExtension === 'csv') {
          // Handle CSV file
          const csvText = e.target.result;
          const rows = csvText.split('\n').map(row => row.split(','));
          headers = rows[0].map(header => header.trim());
          jsonData = rows.slice(1).map(row => {
            const obj = {};
            row.forEach((cell, index) => {
              obj[headers[index]] = cell.trim();
            });
            return obj;
          });
        } else {
          // Handle Excel file
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        }
        
        setExcelData(jsonData);
        
        // Update the suggestionSets with the headers
        setSuggestionSets(prev => [
          headers || [], // First set is now the headers
          prev[1], // Keep the operators
          [], // Reset the values
        ]);

      } catch (error) {
        console.error('Error reading file:', error);
        alert('Error reading file. Please make sure it\'s a valid Excel, CSV, or JSON file.');
      }
    };

    if (file.name.endsWith('.json') || file.name.endsWith('.csv')) {
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

  // Effect for cleaning up polling interval and preview on component unmount
  useEffect(() => {
    const currentPreviewRef = previewContainerRef.current; // Capture the value of .current

    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
      // Cleanup for preview using the captured value
      if (currentPreviewRef) {
        currentPreviewRef.innerHTML = '';
      }
    };
  }, [pollingIntervalId]); // previewContainerRef itself is stable, so not needed in deps for this pattern

  const stopPolling = () => {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      setPollingIntervalId(null);
    }
  };

  const pollJobStatus = async (currentJobId) => {
    if (!currentJobId) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/job-status/${currentJobId}`);
      if (!response.ok) {
        // If status endpoint itself fails, but not a 404 for job not found
        if (response.status !== 404) {
          throw new Error(`Job status check failed: ${response.statusText}`);
        }
        // For 404, job might not be ready or an issue occurred
        const errorData = await response.json().catch(() => ({ message: 'Job not found or an error occurred.' }));
        setJobStatus('error');
        setJobError(errorData.message || 'Failed to retrieve job status.');
        setIsGenerating(false);
        stopPolling();
        return;
      }

      const data = await response.json();
      setJobStatus(data.status);

      if (data.status === 'completed') {
        setJobError(null);
        // Assuming returnValue contains { finalPackagePath: '...' }
        if (data.returnValue && data.returnValue.finalPackagePath) {
          // Construct full URL if finalPackagePath is relative
          const fullDownloadPath = data.returnValue.finalPackagePath.startsWith('http') 
            ? data.returnValue.finalPackagePath
            : `${process.env.NEXT_PUBLIC_API_URL}${data.returnValue.finalPackagePath.startsWith('/') ? '' : '/'}api/download/${data.returnValue.finalPackagePath}`;
          setDownloadLink(fullDownloadPath);
          setIsGenerated(true);

        } else {
          setJobStatus('error');
          setJobError('Job completed but no download path was provided.');
        }
        setIsGenerating(false);
        stopPolling();
      } else if (data.status === 'failed') {
        setJobError(data.failedReason || 'Document generation failed.');
        setIsGenerating(false);
        stopPolling();
      } else if (['active', 'waiting', 'delayed', 'queued'].includes(data.status)) {
        // Job is still processing, continue polling
        setJobError(null); // Clear previous errors if any
      } else if (data.status === 'not_found'){
        setJobStatus('error');
        setJobError('Job not found. It might have expired or never existed.');
        setIsGenerating(false);
        stopPolling();
      } else {
        // Any other unexpected status
        setJobStatus('error');
        setJobError(`Unknown job status: ${data.status}`);
        setIsGenerating(false);
        stopPolling();
      }
    } catch (error) {
      console.error('Error polling job status:', error);
      setJobStatus('error');
      setJobError(error.message || 'An error occurred while checking job status.');
      setIsGenerating(false);
      stopPolling();
    }
  };

  const startJobPolling = (newJobId) => {
    stopPolling(); // Clear any existing interval
    setJobId(newJobId);
    setJobStatus('queued'); // Initial status
    setJobError(null);
    setIsGenerated(false);
    setDownloadLink(null);

    // Immediately poll once, then set interval
    pollJobStatus(newJobId);
    const intervalId = setInterval(() => pollJobStatus(newJobId), 3000); // Poll every 3 seconds
    setPollingIntervalId(intervalId);
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

    setJobId(null); // Reset job ID from previous attempts
    setJobStatus(null);
    setJobError(null);
    setIsGenerated(false);
    setDownloadLink(null);

    try {
      console.log(formData)
      console.log("is calling api")
      const response = await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/upload", {
        method: "POST",
        body: formData,
      });

      console.log(response)

      const responseData = await response.json(); // Expect JSON response now

      if (!response.ok) {
        // Try to get error message from backend response
        const errorMsg = responseData.message || responseData.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMsg);
      }

      console.log(response.status)
      console.log(responseData)

      if (response.status === 200 && responseData.jobId) {
        // Successfully submitted, start polling
        startJobPolling(responseData.jobId);
        // isGenerating remains true until polling determines final state
      } else {
        // Unexpected response if not 202 or no jobId
        throw new Error(responseData.message || 'Unexpected response from server.');
      }

    } catch (error) {
      console.error('Error submitting document generation request:', error);
      setJobStatus('error');
      setJobError(error.message || 'Failed to submit document generation request. Please try again.');
      setIsGenerating(false); // Set to false as the submission itself failed
      // No alert here, rely on UI to show jobError
    }
    // No finally block for setIsGenerating(false) here, it's handled by polling logic or catch block above.
  };

  // Function to handle the download and cleanup
  const handleDownload = () => { // No longer async unless we add server interaction here
    if (!downloadLink || !isGenerated) return;
    console.log(downloadLink)

    try {
      const a = document.createElement('a');
      a.href = downloadLink; // This is now a direct URL from the server
      // Try to get a filename from the URL, or use a generic one
      const fileNameFromServer = downloadLink.substring(downloadLink.lastIndexOf('/') + 1);
      a.download = fileNameFromServer || `generated-documents-${jobId || Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Optional: Reset state after download initiated
      // setDownloadLink(null);
      // setIsGenerated(false);
      // setJobId(null);
      // setJobStatus(null);
    } catch (error) {
      console.error('Error initiating download:', error);
      setJobError('Failed to initiate download. Please try again or check console.');
      // No alert here, rely on UI to show jobError or a notification
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
        previewContainerRef.current.innerHTML = '';
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
            previewContainerRef.current.innerHTML = '';
            
            // Render the document
            await renderAsync(arrayBuffer, previewContainerRef.current, previewContainerRef.current, {
              className: 'docx-preview',
              defaultFont: {
                family: 'Arial',
                size: 11
              },
              inWrapper: true,
              ignoreHeight: false,
              ignoreWidth: false,
              ignoreFonts: false,
              breakPages: true,
              debug: false
            });
          }
        }, 100); // Give enough time for the container to be ready
      } catch (error) {
        console.error('Error previewing document:', error);
        setShowPreview(false);
      }
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

  // The useEffect for preview cleanup is now part of the combined useEffect at the top.

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-white text-xl font-semibold">Document Merge Tool</h2>
          <p className="text-blue-100 text-sm mt-1">Upload your documents and configure merge settings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
            {/* Job Status Display - Spanning both columns */} 
            {(jobId || jobStatus) && (
              <div className="md:col-span-2">
                <div className={`p-4 rounded-md text-sm ${jobStatus === 'failed' || jobStatus === 'error' ? 'bg-red-100 text-red-700' : jobStatus === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {jobStatus === 'queued' && <p>Your request has been queued (Job ID: {jobId}). Waiting for processing...</p>}
                  {jobStatus === 'processing' && <p>Processing document... (Job ID: {jobId})</p>}
                  {jobStatus === 'active' && <p>Document generation is active... (Job ID: {jobId})</p>}
                  {jobStatus === 'waiting' && <p>Job is waiting in the queue... (Job ID: {jobId})</p>}
                  {jobStatus === 'delayed' && <p>Job processing is delayed... (Job ID: {jobId})</p>}
                  {jobStatus === 'completed' && isGenerated && <p>Document generation complete! (Job ID: {jobId}) Ready for download.</p>}
                  {(jobStatus === 'failed' || jobStatus === 'error') && <p>Job Failed (ID: {jobId}): {jobError || 'An unknown error occurred.'}</p>}
                  {jobStatus && !['completed', 'failed', 'error', 'queued', 'processing', 'active', 'waiting', 'delayed'].includes(jobStatus) && 
                    <p>Current Status: {jobStatus} (Job ID: {jobId})</p>}
                </div>
              </div>
            )}
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
                    {showPreview ? 'Hide Preview' : 'View Preview'}
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Source
              </label>
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
                    {excelFile ? excelFile.name : "Drop your data file here (Excel, CSV, or JSON)"}
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
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Output Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Merge Type
                    </label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="single">Single Document</option>
                      <option value="multiple">Multiple Documents</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      File Type
                    </label>
                    <select
                      value={outputExtension}
                      onChange={(e) => setOutputExtension(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="docx">DOCX</option>
                      <option value="pdf">PDF</option>
                    </select>
                  </div>
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
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter condition (e.g., column = value)"
                  className="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
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
                  <div className="absolute z-50 w-full mt-1">
                    <div className="bg-white rounded-md shadow-lg border border-gray-200 overflow-y-auto" style={{ maxHeight: '300px' }}>
                      <ul className="py-1">
                        {filteredSuggestions.map((suggestion, index) => (
                          <li
                            key={suggestion}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                              index === activeSuggestion ? 'bg-blue-50' : ''
                            }`}
                          >
                            {inputValue.split(" ").length > 1 
                              ? `${inputValue.split(" ").slice(0, -1).join(" ")} ${suggestion}`
                              : suggestion
                            }
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 flex flex-row items-center">
                <FiFilter className="w-3 h-3 mr-1" />
                Format: column_name operator value (e.g., &quot;email = john@example.com&quot;)
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
              {isGenerated && downloadLink && jobStatus === 'completed' && (
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
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
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
                <div className="bg-white" style={{ height: '80vh', overflowY: 'auto' }}>
                  <div 
                    ref={previewContainerRef}
                    className="p-4 min-h-full"
                    style={{ minWidth: '800px' }}
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
