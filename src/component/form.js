"use client";

import { useState } from "react";

const Form = () => {
  const [placeholders, setPlaceholders] = useState([""]); // Start with one placeholder

  // Function to add a new placeholder input
  const addPlaceholder = () => {
    setPlaceholders([...placeholders, ""]); // Add an empty string to the array
  };

  return (
    <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start -mt-12">
      <div className="flex flex-col sm:flex-row gap-2 items-center">
        <label className="text-sm sm:text-base">
          Upload DOC file:
          <input
            type="file"
            accept=".doc,.docx"
            className="mt-2 block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-foreground file:text-background hover:file:bg-[#383838]"
          />
        </label>

        <label className="text-sm sm:text-base">
          Upload Excel file:
          <input
            type="file"
            accept=".xls,.xlsx"
            className="mt-2 block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-foreground file:text-background hover:file:bg-[#383838]"
          />
        </label>
      </div>

      {/* Dynamic Placeholders Section */}
      <div className="flex flex-col gap-2 items-center mt-2 w-full">
        {placeholders.map((_, index) => (
          <input
            key={index}
            type="text"
            placeholder={`Enter Placeholder ${index + 1}`}
            className="mt-2 block w-full sm:w-auto text-sm text-gray-700 py-2 px-4 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ))}
        <button
          type="button"
          onClick={addPlaceholder}
          className="mt-2 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Add Placeholder
        </button>
      </div>
    </main>
  );
};

export default Form;
