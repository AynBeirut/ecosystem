
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import BrandMark from "@/components/BrandMark";
import { BRAND } from "@/lib/branding";

const Hero = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5 }}
      className="text-center py-12"
    >
      <div className="mb-4 flex justify-center">
        <BrandMark size="lg" />
      </div>
      <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-2 max-w-2xl mx-auto">
        {BRAND.tagline}
      </p>
      <p className="text-sm text-muted-foreground mb-8">
        Same account as{" "}
        <a href={BRAND.ecosystemUrl} className="text-[#38B2AC] hover:underline" target="_blank" rel="noopener noreferrer">
          grabio.space
        </a>
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Button size="lg" className="bg-[#38B2AC] hover:bg-[#2C9A94] text-white">
          Get Started
        </Button>
        <Button variant="outline" size="lg" asChild>
          <a href={`${BRAND.ecosystemUrl}/features`} target="_blank" rel="noopener noreferrer">
            Explore Grabio
          </a>
        </Button>
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-6">
        {[
          "Professional Invoices",
          "Receipt Management",
          "Multi-Currency Support",
        ].map((label) => (
          <div key={label} className="flex items-center">
            <div className="bg-teal-50 dark:bg-teal-950/30 p-2 rounded-full">
              <div className="h-5 w-5 rounded-full bg-[#38B2AC]/20 border-2 border-[#38B2AC]" />
            </div>
            <span className="ml-2 text-gray-600 dark:text-gray-300">{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default Hero;
