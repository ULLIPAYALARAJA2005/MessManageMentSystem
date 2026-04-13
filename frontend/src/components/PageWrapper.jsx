import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PageWrapper = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsLoading(true);
    // Removed 500ms artificial routing delay for instant navigation
    setIsLoading(false);
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
