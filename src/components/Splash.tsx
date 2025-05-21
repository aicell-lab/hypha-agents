import React from 'react';
import { motion } from 'framer-motion';

interface SplashProps {
  className?: string;
}

const Splash: React.FC<SplashProps> = ({ className = '' }) => {
  return (
    <div className={`flex justify-center items-center w-full py-12 relative overflow-hidden rounded-3xl shadow-sm ${className}`}>
      {/* Animated SVG Background with parallax effect */}
      <motion.div 
        className="absolute inset-0 w-full h-full z-0 rounded-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1.0 }}
        transition={{ duration: 1.5 }}
      >
        <motion.div 
          className="w-full h-full rounded-3xl"
          animate={{ 
            y: [0, -10, 0],
          }}
          transition={{ 
            repeat: Infinity, 
            duration: 8,
            ease: "easeInOut" 
          }}
        >
          <img src="/animated-background.svg" alt="background" className="w-full h-full object-cover rounded-3xl" />
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <motion.div 
        className="relative z-10 w-full max-w-4xl mx-auto px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        <div className="flex flex-col items-center text-center">
          {/* Hypha Logo with animation */}
          <motion.div 
            className="mb-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              duration: 0.8, 
              delay: 0.6,
              type: "spring",
              stiffness: 120
            }}
          >
            <img 
              src="/logo.png" 
              alt="Hypha Logo" 
              className="w-32 h-32 object-contain drop-shadow-lg"
            />
          </motion.div>
          
          {/* Title with text reveal animation - now black with increased line height */}
          <motion.h1 
            className="text-4xl md:text-5xl font-bold mb-2 text-black leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            Euro-BioImaging Agents
          </motion.h1>
          
          {/* Tagline with staggered animation */}
          <motion.p 
            className="text-lg md:text-xl text-gray-600 mb-6 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            Build. Connect. Evolve.
          </motion.p>
          
          {/* Animated particles with custom animations */}
          <div className="relative w-full max-w-md h-12 mt-4">
            {[0, 0.3, 0.6, 0.9, 1.2].map((delay, index) => (
              <motion.div
                key={index}
                className={`absolute w-${index % 2 ? 2 : 3} h-${index % 2 ? 2 : 3} bg-blue-${400 + (index * 100)} rounded-full`}
                style={{
                  top: `${20 + (index * 15)}%`,
                  left: `${20 + (index * 15)}%`,
                }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{
                  duration: 2,
                  delay: delay,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Splash; 