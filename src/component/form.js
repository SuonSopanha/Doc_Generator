"use client";
import { useState } from "react";

const Form = () => {
  const [placeholders, setPlaceholders] = useState([""]); // Start with one placeholder
  const [docFile, setDocFile] = useState(null);
  const [excelFile, setExcelFile] = useState(null);

  // Function to add a new placeholder input
  const addPlaceholder = () => {
    setPlaceholders([...placeholders, ""]); // Add an empty string to the array
  };

  // Function to handle file uploads and placeholders
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if files are uploaded
    if (!docFile || !excelFile) {
      alert("Please upload both DOC and Excel files.");
      return;
    }

    // Create a FormData object to send files and placeholders
    const formData = new FormData();
    formData.append("docFile", docFile);
    formData.append("excelFile", excelFile);

    // Append placeholders to formData
    placeholders.forEach((placeholder, index) => {
      formData.append(`placeholder${index + 1}`, placeholder);
    });

    try {
      const response = await fetch("http://localhost:4000/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        // Create a blob from the response
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob); // Create a URL for the blob

        // Create an anchor element and trigger the download
        const a = document.createElement("a");
        a.href = url;
        a.download = "generated-documents.zip"; // Set a default file name
        document.body.appendChild(a);
        a.click(); // Simulate a click on the anchor element to trigger the download
        a.remove(); // Remove the anchor element from the DOM
        window.URL.revokeObjectURL(url); // Clean up the URL

        alert("Files and placeholders uploaded successfully. Downloading the ZIP file...");
      } else {
        alert("Failed to upload files.");
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-8 row-start-2 items-center sm:items-start -mt-12"
    >
      <div className="flex flex-col sm:flex-row gap-2 items-center">
        <label className="text-sm sm:text-base">
          Upload DOC file:
          <input
            type="file"
            accept=".doc,.docx"
            className="mt-2 block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-foreground file:text-background hover:file:bg-[#383838]"
            onChange={(e) => setDocFile(e.target.files[0])}
          />
        </label>

        <label className="text-sm sm:text-base">
          Upload Excel file:
          <input
            type="file"
            accept=".xls,.xlsx"
            className="mt-2 block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-foreground file:text-background hover:file:bg-[#383838]"
            onChange={(e) => setExcelFile(e.target.files[0])}
          />
        </label>
      </div>

      {/* Dynamic Placeholders Section */}
      {/* <div className="flex flex-col gap-2 items-center mt-2 w-full">
        {placeholders.map((placeholder, index) => (
          <input
            key={index}
            type="text"
            value={placeholder}
            placeholder={`Enter Placeholder ${index + 1}`}
            className="mt-2 block w-full sm:w-auto text-sm text-gray-700 py-2 px-4 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => {
              const newPlaceholders = [...placeholders];
              newPlaceholders[index] = e.target.value;
              setPlaceholders(newPlaceholders);
            }}
          />
        ))}
        <button
          type="button"
          onClick={addPlaceholder}
          className="mt-2 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Add Placeholder
        </button>
      </div> */}

      <div className="w-full flex items-center justify-center">
        <button
          type="submit"
          className="mt-4 py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          Submit
        </button>
      </div>
    </form>
  );
};

export default Form;
