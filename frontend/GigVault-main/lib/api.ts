const BASE_URL = process.env.NEXT_PUBLIC_GIGVAULT_URL || "http://localhost:4000";

async function fetchAPI(endpoint: string, payload?: any) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  let json;
  try {
    json = await res.json();
  } catch (err) {}
  
  if (!res.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
  return json;
}

export const api = {
  consent: (customerIdentifier: string) => 
    fetchAPI("/consent", { customerIdentifier }),
    
  fetchEnvelope: (sessionId: string, consentId: string) => 
    fetchAPI("/fetch", { sessionId, consentId }),
    
  derive: (sessionId: string, confirmedPayers?: string[]) => 
    fetchAPI("/derive", { sessionId, confirmedPayers }),
    
  issue: (sessionId: string, holderPublicKey: string, anonAadhaarData: any, tierClaims?: any) => 
    fetchAPI("/issue", { 
      sessionId, 
      holderPublicKey, 
      holderKeyScheme: "eip191-secp256k1", 
      anonAadhaar: anonAadhaarData,
      tierClaims
    }),
    
  challenge: (sessionId: string, verifierLabel?: string) => 
    fetchAPI("/challenge", { sessionId, verifierLabel }),
    
  present: (sessionId: string, challengeId: string, signature: string) => 
    fetchAPI("/present", { sessionId, challengeId, signature }),
    
  presentTicket: (sessionId: string) => 
    fetchAPI("/present/ticket", { sessionId }),
    
  admit: (sessionId: string, verifierLabel?: string) => 
    fetchAPI("/admit", { sessionId, verifierLabel }),
    
  admitScan: (qr: string, verifierLabel?: string) => 
    fetchAPI("/admit/scan", { qr, verifierLabel }),
    
  revoke: (sessionId: string, reason?: string) => 
    fetchAPI("/revoke", { sessionId, reason }),
};
