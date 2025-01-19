import Image from "next/image";
import Form from "@/component/form";

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-screen bg-blue-50">
      {/* Hero Section */}
      <section className="w-full bg-blue-50 py-16 px-8 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Automate Your Document Generation
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Say goodbye to manual document creation. Our tool lets you generate
            customized documents in seconds, streamlining your workflow and
            saving valuable time. Simply upload your template and data, select
            the format, and download your generated documents effortlessly.
          </p>
        </div>
      </section>


      {/* Form Section */}
      <div className="w-full min-w-full mx-auto px-4 ">
        <Form />
      </div>

      {/* Footer */}
      <footer className="w-full bg-gray-800 py-8 text-center text-gray-300 mt-16">
        <div className="max-w-4xl mx-auto">
          <p className="mb-4">
            &copy; {new Date().getFullYear()} Auto Docx Generator. All rights
            reserved.
          </p>
          <div className="flex justify-center space-x-6 mb-4">
            <a href="#" className="hover:text-white">
              Terms of Service
            </a>
            <a href="#" className="hover:text-white">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white">
              Contact Us
            </a>
          </div>
          <p>Follow us on:</p>
          <div className="flex justify-center space-x-4 mt-2">
            <a href="#" aria-label="Twitter" className="hover:text-white">
              Twitter
            </a>
            <a href="#" aria-label="Facebook" className="hover:text-white">
              Facebook
            </a>
            <a href="#" aria-label="LinkedIn" className="hover:text-white">
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
