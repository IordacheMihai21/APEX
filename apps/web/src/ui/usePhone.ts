import { useEffect, useState } from "react";

/** The phone layout: under 720 px wide, where the map needs every pixel and panels collapse. */
const QUERY = "(max-width: 719px)";

export function usePhone(): boolean {
  const [phone, setPhone] = useState(() => typeof matchMedia !== "undefined" && matchMedia(QUERY).matches);
  useEffect(() => {
    const m = matchMedia(QUERY);
    const on = () => setPhone(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}
