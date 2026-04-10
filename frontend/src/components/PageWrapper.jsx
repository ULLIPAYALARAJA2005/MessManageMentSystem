import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PageWrapper = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Simulate a brief loading state when route changes
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500); // 500ms for the "redirection" effect

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <>
      {isLoading && (
        <div className="route-loader">
          <div className="route-loader-bar"></div>
        </div>
      )}
      <div key={location.pathname} className="page-transition">
        {children}
      </div>
    </>
  );
};

export default PageWrapper;
