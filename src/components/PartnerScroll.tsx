import React, { useState, useRef, useEffect } from 'react';

interface Partner {
  name: string;
  icon: string;
  link?: string;
  id: string;
  type?: 'university' | 'research_institute' | 'telecom';
  country?: string;
}

interface ManifestResponse {
  manifest: {
    documentation?: string;
    git_repo?: string;
    config: {
      docs?: string;
      partners: Array<{
        name: string;
        icon: string;
        id: string;
      }>;
    };
  };
}

const PartnerScroll: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // For now, we'll use placeholder data for academic partners
    const placeholderPartners: Partner[] = [
      {
        name: "AT&T",
        icon: "/img/partners/att.png",
        id: "att",
        type: "telecom",
        country: "USA",
        link: "https://www.att.com"
      },
      {
        name: "Verizon",
        icon: "/img/partners/verizon.png", 
        id: "verizon",
        type: "telecom",
        country: "USA",
        link: "https://www.verizon.com"
      },
      {
        name: "Deutsche Telekom",
        icon: "/img/partners/dt.png",
        id: "dt",
        type: "telecom", 
        country: "Germany",
        link: "https://www.telekom.com"
      },
      {
        name: "Vodafone",
        icon: "/img/partners/vodafone.png",
        id: "vodafone",
        type: "telecom",
        country: "UK",
        link: "https://www.vodafone.com"
      },
      {
        name: "Orange",
        icon: "/img/partners/orange.png",
        id: "orange",
        type: "telecom",
        country: "France",
        link: "https://www.orange.com"
      },
      {
        name: "Telefónica",
        icon: "/img/partners/telefonica.png",
        id: "telefonica", 
        type: "telecom",
        country: "Spain",
        link: "https://www.telefonica.com"
      },
      {
        name: "NTT",
        icon: "/img/partners/ntt.png",
        id: "ntt",
        type: "telecom",
        country: "Japan",
        link: "https://www.ntt.com"
      }
    ];

    setPartners(placeholderPartners);
    setLoading(false);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        Error loading partners: {error}
      </div>
    );
  }

  return (
    <div className="relative max-w-[1400px] mx-auto px-4 mt-8">
      <h2 className="text-2xl font-semibold text-center mb-6">Partner Organizations</h2>
      <p className="text-gray-600 text-center mb-8">
        Leading telecom and technology companies collaborating to advance AI agent development
      </p>
      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white shadow-lg rounded-full p-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      
      <div
        ref={scrollRef}
        className="flex overflow-x-auto space-x-8 py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          setShowLeftArrow(target.scrollLeft > 0);
          setShowRightArrow(
            target.scrollLeft < target.scrollWidth - target.clientWidth
          );
        }}
      >
        {partners.map((partner) => (
          <a
            key={partner.id}
            href={partner.link}
            className="flex flex-col items-center space-y-4 min-w-[200px] group"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="w-32 h-32 flex items-center justify-center p-4 bg-white rounded-lg shadow-sm transition-transform group-hover:scale-105">
              <img 
                src={partner.icon} 
                alt={partner.name} 
                className="w-full h-full object-contain"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = '/fallback-icon.png';
                }}
              />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900">{partner.name}</h3>
              <p className="text-sm text-gray-500">{partner.country}</p>
            </div>
          </a>
        ))}
      </div>

      {showRightArrow && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white shadow-lg rounded-full p-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default PartnerScroll; 