import api from "./api";

export const COMPANY_DEFAULTS = {
  name: "Bhuvan Institute of Fashion Design",
  short_name: "BIFD",
  logo: "",
  address: "",
  phone: "",
  email: "",
  website: "",
};

let cache = null;

export async function getCompany(force = false) {
  if (cache && !force) return cache;
  try {
    const r = await api.get("/company-settings");
    cache = { ...COMPANY_DEFAULTS, ...r.data };
  } catch {
    cache = COMPANY_DEFAULTS;
  }
  return cache;
}

export function clearCompanyCache() {
  cache = null;
}
