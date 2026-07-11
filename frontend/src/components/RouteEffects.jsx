import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function getRouteTitle(pathname) {
  if (pathname === "/") {
    return "Recipe Match";
  }

  if (pathname === "/deck") {
    return "Recipe Deck | Recipe Match";
  }

  if (pathname === "/liked") {
    return "Liked Recipes | Recipe Match";
  }

  if (pathname.startsWith("/recipe/")) {
    return "Recipe | Recipe Match";
  }

  return "Page Not Found | Recipe Match";
}

function RouteEffects() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = getRouteTitle(pathname);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector("main h1");

      if (heading instanceof HTMLElement) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}

export default RouteEffects;
