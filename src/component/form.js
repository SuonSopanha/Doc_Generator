"use client";
import { useState } from "react";

const Form = () => {
  const [placeholders, setPlaceholders] = useState([""]);
  const [docFile, setDocFile] = useState(null);
  const [excelFile, setExcelFile] = useState(null);
  const [outputFormat, setOutputFormat] = useState("single");
  const [outputExtension, setOutputExtension] = useState("docx");
  const [password, setPassword] = useState(null); // State for the password
  const [downloadLink, setDownloadLink] = useState(null); // State for the download link

  const addPlaceholder = () => {
    setPlaceholders([...placeholders, ""]);
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
            accept=".xls,.xlsx"
            className="w-full text-sm border border-gray-300 rounded-md file:mr-3 file:py-1 file:px-3 file:border-0 file:rounded-md file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
            onChange={(e) => setExcelFile(e.target.files[0])}
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
