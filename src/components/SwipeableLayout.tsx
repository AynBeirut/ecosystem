import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import { ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SwipeableLayoutProps {
  children: React.ReactNode;
  onSwipeRight?: () => void;
}

const SwipeableLayout: React.FC<SwipeableLayoutProps> = ({ children, onSwipeRight }) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check if user has seen the swipe tutorial
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('swipeTutorialSeen');
    if (!hasSeenTutorial) {
      // Show tutorial after 2 seconds
      const timer = setTimeout(() => {
        setShowTutorial(true);
        toast({
          title: "👆 Swipe Right to Go Back",
          description: "Swipe from left to right anywhere on the screen to go back",
          duration: 5000,
        });
        // Hide after showing
        setTimeout(() => {
          setShowTutorial(false);
          localStorage.setItem('swipeTutorialSeen', 'true');
        }, 5000);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchEnd - touchStart;
    const isRightSwipe = distance > minSwipeDistance;
    
    if (isRightSwipe) {
      if (onSwipeRight) {
        onSwipeRight();
      } else {
        // Default behavior: go back to dashboard
        if (user?.role === 'admin') {
          navigate('/admin/dashboard');
        } else if (user?.role === 'sub_account') {
          navigate('/team/dashboard');
        } else {
          navigate(-1);
        }
      }
    }
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative"
    >
      {/* Swipe Tutorial Indicator */}
      {showTutorial && (
        <div className="fixed top-1/2 left-4 -translate-y-1/2 z-50 animate-bounce-horizontal pointer-events-none">
          <div className="bg-market-primary text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Swipe to go back</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

export default SwipeableLayout;
