/** GST state codes (the first two digits of every GSTIN) and their names, the one list the address forms pick from. Mirrors
 * erp-dine-backend/db/pincodes.py `STATE_CODES`; the server stores a state under exactly these names and refuses any other. */
const GST_CODES: { code: string; name: string }[] = [
  ["01", "Jammu & Kashmir"],
  ["02", "Himachal Pradesh"],
  ["03", "Punjab"],
  ["04", "Chandigarh"],
  ["05", "Uttarakhand"],
  ["06", "Haryana"],
  ["07", "Delhi"],
  ["08", "Rajasthan"],
  ["09", "Uttar Pradesh"],
  ["10", "Bihar"],
  ["11", "Sikkim"],
  ["12", "Arunachal Pradesh"],
  ["13", "Nagaland"],
  ["14", "Manipur"],
  ["15", "Mizoram"],
  ["16", "Tripura"],
  ["17", "Meghalaya"],
  ["18", "Assam"],
  ["19", "West Bengal"],
  ["20", "Jharkhand"],
  ["21", "Odisha"],
  ["22", "Chhattisgarh"],
  ["23", "Madhya Pradesh"],
  ["24", "Gujarat"],
  ["26", "Dadra & Nagar Haveli and Daman & Diu"],
  ["27", "Maharashtra"],
  ["29", "Karnataka"],
  ["30", "Goa"],
  ["31", "Lakshadweep"],
  ["32", "Kerala"],
  ["33", "Tamil Nadu"],
  ["34", "Puducherry"],
  ["35", "Andaman & Nicobar Islands"],
  ["36", "Telangana"],
  ["37", "Andhra Pradesh"],
  ["38", "Ladakh"],
  ["97", "Other Territory"],
].map(([code, name]) => ({ code, name }));

/** The states and union territories an address can be in, A to Z ("Other Territory" is only ever a GSTIN's). */
export const STATES = GST_CODES.filter((s) => s.code !== "97").sort((a, b) =>
  a.name.localeCompare(b.name),
);

const STATE_NAMES = new Set(STATES.map((s) => s.name));

export const isStateName = (name: string): boolean => STATE_NAMES.has(name);
