import React from 'react';

const About: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-gray-900">About Elia Platform</h1>
      
      <section className="mb-12 bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Our Mission</h2>
        <p className="text-gray-600 leading-relaxed">
          Elia Platform empowers organizations to build and deploy customizable AI agents with deep telecom domain expertise. Our platform combines advanced LLM capabilities with specialized knowledge bases and tools to create intelligent agents that understand and operate within the telecommunications domain.
        </p>
      </section>

      <section className="mb-12 bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Key Features</h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            'Customizable AI agents',
            'Domain-specific knowledge bases',
            'Extensible Python-based tools',
            'Real-time agent communication',
            'Collaborative agent development',
            'Secure resource management',
            'Workflow orchestration',
            'Community sharing'
          ].map((item, index) => (
            <li key={index} className="flex items-start space-x-3">
              <svg className="h-6 w-6 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-600">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-12 bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Get Started</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a href="/create-agent" 
             className="flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition duration-150 ease-in-out">
            Create an Agent
          </a>
          <a href="/documentation" 
             className="flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition duration-150 ease-in-out">
            View Documentation
          </a>
        </div>
      </section>

      <section className="mb-12 bg-white rounded-lg shadow-sm p-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Our Approach</h2>
        <p className="text-gray-600 leading-relaxed mb-6">
          Elia Platform leverages advanced LLM technology combined with specialized knowledge bases to create AI agents that truly understand the telecommunications domain. Our platform enables rapid development and deployment of custom agents that can handle complex telecom-specific tasks.
        </p>
        <p className="text-gray-600 leading-relaxed">
          Through our extensible tool system and collaborative features, organizations can build, share, and improve their agents while maintaining full control over their resources and knowledge bases.
        </p>
      </section>
    </div>
  );
};

export default About; 