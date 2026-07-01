import React from 'react';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="w-full animate-pulse space-y-6">
      {/* Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs h-32">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
            <div className="h-8 bg-slate-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div className="h-6 bg-slate-200 rounded w-1/4 mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex space-x-4">
              <div className="h-10 bg-slate-100 rounded flex-1"></div>
              <div className="h-10 bg-slate-100 rounded flex-1"></div>
              <div className="h-10 bg-slate-100 rounded flex-1"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
