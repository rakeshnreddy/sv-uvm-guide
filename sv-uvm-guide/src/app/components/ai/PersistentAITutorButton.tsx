"use client"; // Required for Framer Motion event handlers

import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react'; // Using an icon as an example

const AITutorWidget = () => {
  return (
    <motion.button
      className="fixed bottom-8 right-8 bg-accent text-background p-4 rounded-full shadow-lg flex items-center justify-center"
      whileHover={{
        scale: 1.1,
        boxShadow: "0px 0px 20px rgba(100, 255, 218, 0.7)", // Accent color glow
      }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      // onClick functionality to be added later
    >
      <MessageCircle size={28} />
    </motion.button>
  );
};

export default AITutorWidget;
