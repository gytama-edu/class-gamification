import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./ErrorBoundary";

const isSupabase = import.meta.env.VITE_DATA_SOURCE === "supabase";
const hasUrl = !!import.meta.env.VITE_SUPABASE_URL;
const hasKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;

if (isSupabase && (!hasUrl || !hasKey)) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <div className="min-h-screen bg-mission-bg flex flex-col items-center justify-center p-8">
        <div className="bg-mission-panel border border-mission-danger/50 p-8 rounded-2xl max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold text-mission-danger mb-4">
            Configuration Error
          </h1>
          <p className="text-mission-secondary-text mb-6">
            The application is configured to use Supabase
            (VITE_DATA_SOURCE=supabase), but the required environment variables
            are missing.
          </p>
          <div className="text-left bg-black/50 p-4 rounded-xl space-y-2 mb-6">
            <p className="text-sm font-mono text-gray-300">
              VITE_SUPABASE_URL: {hasUrl ? "✅ Present" : "❌ Missing"}
            </p>
            <p className="text-sm font-mono text-gray-300">
              VITE_SUPABASE_ANON_KEY: {hasKey ? "✅ Present" : "❌ Missing"}
            </p>
          </div>
          <p className="text-sm text-mission-muted-text">
            Please add these keys to your workspace settings to continue.
          </p>
        </div>
      </div>
    </StrictMode>,
  );
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
