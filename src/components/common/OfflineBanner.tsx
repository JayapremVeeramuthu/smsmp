import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowBackOnline(true);
      const timer = setTimeout(() => {
        setShowBackOnline(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowBackOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOffline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 py-2.5 px-4 shadow-md transition-all duration-300 animate-in slide-in-from-top">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center text-xs md:text-sm font-medium">
          <WifiOff size={16} className="animate-pulse flex-shrink-0" />
          <span>
            You're offline. Previously synced data is available. New changes will sync when you're back online.
          </span>
        </div>
      </div>
    );
  }

  if (showBackOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-emerald-600 text-white py-2.5 px-4 shadow-md transition-all duration-300 animate-in slide-in-from-top">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center text-xs md:text-sm font-medium">
          <Wifi size={16} className="flex-shrink-0" />
          <span>
            Connection restored! Syncing updates...
          </span>
        </div>
      </div>
    );
  }

  return null;
};
