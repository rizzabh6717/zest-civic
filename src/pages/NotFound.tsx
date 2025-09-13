import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-xl text-muted-foreground">Page not found</p>
        <p className="mb-8 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a 
          href="/" 
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
