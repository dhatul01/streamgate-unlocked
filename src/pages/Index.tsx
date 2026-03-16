import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="animate-float mb-8">
        <img src={logo} alt="RealTime48 Logo" className="h-32 w-32 tv:h-48 tv:w-48" />
      </div>
      <h1 className="mb-2 text-4xl font-bold tracking-tight text-foreground tv:text-5xl">
        Real<span className="text-primary">Time48</span>
      </h1>
      <p className="mb-8 text-center text-muted-foreground tv:text-lg">
        Secure Streaming Platform
      </p>
      <button
        onClick={() => navigate("/admin")}
        className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 tv:px-8 tv:py-4 tv:text-base"
      >
        Admin Panel
      </button>
    </div>
  );
};

export default Index;
