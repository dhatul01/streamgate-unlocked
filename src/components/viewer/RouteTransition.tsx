import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const RouteTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [displayed, setDisplayed] = useState(children);
  const [stage, setStage] = useState<"in" | "out">("in");
  const [key, setKey] = useState(location.pathname);

  useEffect(() => {
    if (location.pathname === key) {
      setDisplayed(children);
      return;
    }
    setStage("out");
    const t = setTimeout(() => {
      setDisplayed(children);
      setKey(location.pathname);
      setStage("in");
    }, 150);
    return () => clearTimeout(t);
  }, [location.pathname, children, key]);

  return (
    <div
      className={`transition-all duration-200 ease-out ${
        stage === "in" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
      }`}
    >
      {displayed}
    </div>
  );
};

export default RouteTransition;
