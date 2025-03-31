import React from 'react';
import { BiCube } from 'react-icons/bi';
import { SITE_ID, SITE_NAME } from '../utils/env';

const footerLinks = [
  {
    label: "View source code on GitHub",
    href: `https://github.com/your-org/${SITE_ID}`,
    icon: "/img/github.png",
    caption: "Source Code"
  },
  {
    label: "Report issues or request features",
    href: `https://github.com/your-org/${SITE_ID}/issues`,
    icon: "/img/feedback-icon.png",
    caption: "Feedback"
  }
];

const Footer: React.FC = () => {
  return (
    <footer className="w-full py-8 px-4 mt-16 bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto">
        {/* Links Section */}
        <div className="flex flex-wrap justify-center items-start gap-4 mb-8">
          {footerLinks.map((link, index) => (
            <div key={index} className="w-[150px] text-center">
              <div className="group relative" title={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block hover:opacity-80 transition-opacity"
                >
                  <figure className="flex flex-col items-center">
                    <img
                      src={link.icon}
                      alt={link.caption}
                      className="h-[45px] w-auto object-contain mb-2"
                    />
                    <figcaption className="text-sm text-gray-600 hidden md:block">
                      {link.caption}
                    </figcaption>
                  </figure>
                </a>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg whitespace-nowrap z-10">
                  {link.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Content Section */}
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-center text-2xl font-bold text-blue-600 mb-4">
              <BiCube className="mr-2" size={24} />
              {SITE_NAME}
            </div>
            <p className="text-base text-gray-700 font-medium mb-4">
              Build and deploy intelligent AI agents
            </p>
            <p className="text-sm text-gray-600 leading-relaxed px-4">
              {SITE_NAME} enables organizations to create customized AI agents with specialized domain expertise. Join our community to build, share, and improve intelligent agents together.
            </p>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed px-4">
            &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 