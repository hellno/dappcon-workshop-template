// Note: This implementation uses direct HTTP API calls to Circles RPC endpoints
// and does NOT require the Circles SDK or window.ethereum provider

import { unstable_cache } from 'next/cache';

interface CirclesProfile {
  name: string;
  description?: string;
  avatar?: string;
  [key: string]: unknown;
}

interface CirclesEvent {
  event: string;
  values?: {
    owner?: string;
    safeAddress?: string;
    [key: string]: unknown;
  };
  blockNumber?: number;
  [key: string]: unknown;
}

export interface CirclesData {
  isOnCircles: boolean;
  mainAddress?: string;
  profileData?: CirclesProfile;
  signerAddress?: string;
}

export interface DebugData {
  addressChecks: Array<{
    address: string;
    directCheck: { exists: boolean; profileData?: CirclesProfile };
    signerCheck: { exists: boolean; mainAddress?: string; profileData?: CirclesProfile };
  }>;
}

export interface CirclesResult {
  circlesData: CirclesData;
  debugData: DebugData;
}

export async function checkCirclesStatus(ethAddresses: string[]): Promise<CirclesData> {
  const result = await checkCirclesStatusWithDebug(ethAddresses);
  return result.circlesData;
}

export async function checkCirclesStatusWithDebug(ethAddresses: string[]): Promise<CirclesResult> {
  console.log('Checking Circles status for addresses:', ethAddresses);
  
  const debugData: DebugData = {
    addressChecks: []
  };
  
  // Check ALL addresses for both direct and signer relationships
  for (const address of ethAddresses) {
    console.log('Checking address:', address);
    
    // Strategy 1: Direct lookup
    const direct = await checkDirectCirclesProfile(address);
    
    // Strategy 2: Signer to main account lookup
    const signer = await checkSignerToMainAccount(address);
    
    // Store debug data
    debugData.addressChecks.push({
      address,
      directCheck: direct,
      signerCheck: signer
    });
    
    // Return first successful match (prioritize direct, then signer)
    if (direct.exists) {
      console.log('Found direct Circles profile for:', address);
      return {
        circlesData: {
          isOnCircles: true,
          mainAddress: address,
          profileData: direct.profileData
        },
        debugData
      };
    }
    
    if (signer.exists) {
      console.log('Found main account via signer lookup for:', address, '-> main:', signer.mainAddress);
      return {
        circlesData: {
          isOnCircles: true,
          mainAddress: signer.mainAddress,
          profileData: signer.profileData,
          signerAddress: address
        },
        debugData
      };
    }
  }
  
  console.log('No Circles profile found for any address:', ethAddresses);
  return {
    circlesData: { isOnCircles: false },
    debugData
  };
}

// Cached version of direct profile lookup - Next.js cache with 24 hour TTL
const checkDirectCirclesProfile = unstable_cache(
  async (address: string) => {
  try {
    const url = `https://rpc.aboutcircles.com/profiles/search?address=${address}`;
    console.log(`🔍 Direct profile lookup for: ${address} (cache miss - making API call)`);
    console.log(`📡 Profile URL: ${url}`);
    
    const response = await fetch(url);
    
    console.log(`📡 Profile response status: ${response.status}`);
    
    if (!response.ok) {
      console.log(`❌ Profile request failed: ${response.status} ${response.statusText}`);
      return { exists: false };
    }
    
    const data = await response.json();
    console.log(`📊 Profile data for ${address}:`, data);
    
    // Check if data is an array with profile objects
    if (Array.isArray(data) && data.length > 0 && data[0].name) {
      const profile = data[0];
      console.log(`✅ Found Circles profile for ${address}:`, profile.name);
      return {
        exists: true,
        profileData: profile
      };
    }
    // Check if data is a direct profile object
    else if (data && data.name) {
      console.log(`✅ Found Circles profile for ${address}:`, data.name);
      return {
        exists: true,
        profileData: data
      };
    } else {
      console.log(`❌ No profile name found for ${address}. Data structure:`, {
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : 'N/A',
        firstItem: Array.isArray(data) && data.length > 0 ? data[0] : 'N/A',
        data: data
      });
    }
  } catch (error) {
    console.log(`💥 Direct lookup failed for ${address}:`, error);
  }
  
  return { exists: false };
  },
  ['direct-circles-profile'], // Cache key will be parameterized by address automatically
  {
    revalidate: 86400, // 24 hours
    tags: ['circles-profile']
  }
);

// Cached version of signer to main account lookup - Next.js cache with 24 hour TTL
const checkSignerToMainAccount = unstable_cache(
  async (signerAddress: string) => {
  try {
    console.log(`🔍 Checking signer events for: ${signerAddress} (cache miss - making API call)`);
    
    // Use circles_events to find Safe_AddedOwner events
    const response = await fetch("https://rpc.aboutcircles.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "circles_events",
        params: [signerAddress, 0, null]
      })
    });
    
    console.log(`📡 RPC Response status: ${response.status}`);
    
    if (!response.ok) {
      console.log(`❌ RPC request failed: ${response.status} ${response.statusText}`);
      return { exists: false };
    }
    
    const eventsData = await response.json();
    console.log(`📊 Events data for ${signerAddress}:`, eventsData);
    
    if (!eventsData.result) {
      console.log(`❌ No result in events data for ${signerAddress}`);
      return { exists: false };
    }
    
    console.log(`📋 Total events found: ${eventsData.result.length}`);
    
    // Log all events to see what we're getting
    eventsData.result.forEach((event: CirclesEvent, index: number) => {
      console.log(`Event ${index}:`, {
        event: event.event,
        values: event.values,
        blockNumber: event.blockNumber
      });
    });
    
    const ownerEvents = eventsData.result.filter((event: CirclesEvent) =>
      event.event === "Safe_AddedOwner" &&
      event.values?.owner?.toLowerCase() === signerAddress.toLowerCase()
    );
    
    console.log(`🎯 Safe_AddedOwner events for ${signerAddress}: ${ownerEvents.length}`);
    ownerEvents.forEach((event: CirclesEvent, index: number) => {
      console.log(`  Owner Event ${index}:`, {
        safeAddress: event.values?.safeAddress,
        owner: event.values?.owner,
        blockNumber: event.blockNumber
      });
    });
    
    // Check each Safe address for Circles profile
    for (const event of ownerEvents) {
      const safeAddress = event.values?.safeAddress;
      if (!safeAddress) continue;
      
      console.log(`🔐 Checking Safe profile for: ${safeAddress}`);
      
      const safeProfile = await checkDirectCirclesProfile(safeAddress);
      
      if (safeProfile.exists) {
        console.log(`✅ Found Circles profile via Safe: ${safeAddress}`);
        return {
          exists: true,
          mainAddress: safeAddress,
          profileData: safeProfile.profileData
        };
      } else {
        console.log(`❌ No Circles profile found for Safe: ${safeAddress}`);
      }
    }
    
    console.log(`❌ No valid Safe with Circles profile found for signer: ${signerAddress}`);
  } catch (error) {
    console.log(`💥 Signer lookup failed for ${signerAddress}:`, error);
  }
  
  return { exists: false };
  },
  ['signer-circles-lookup'], // Cache key will be parameterized by signerAddress automatically
  {
    revalidate: 86400, // 24 hours
    tags: ['circles-signer']
  }
);

// Batch processing function to avoid overwhelming the API
export async function batchCheckCirclesStatus(
  users: Array<{ fid: number; username: string; verified_addresses?: { eth_addresses: string[] } }>
): Promise<Map<number, { circlesData: CirclesData; debugData: DebugData }>> {
  const results = new Map<number, { circlesData: CirclesData; debugData: DebugData }>();
  
  console.log('=== STARTING BATCH CIRCLES LOOKUP ===');
  console.log('Total users to check:', users.length);
  
  // Filter users that have verified addresses
  const usersWithAddresses = users.filter(user => 
    user.verified_addresses?.eth_addresses && user.verified_addresses.eth_addresses.length > 0
  );
  
  console.log('Users with verified addresses:', usersWithAddresses.length);
  
  // Process in batches to avoid rate limiting
  const batchSize = 3; // Reduced batch size to be more respectful to Circles API
  for (let i = 0; i < usersWithAddresses.length; i += batchSize) {
    const batch = usersWithAddresses.slice(i, i + batchSize);
    
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(usersWithAddresses.length / batchSize)}`);
    
    const batchPromises = batch.map(async (user) => {
      console.log(`Checking user @${user.username} (FID: ${user.fid}) with addresses:`, user.verified_addresses!.eth_addresses);
      
      const result = await checkCirclesStatusWithDebug(user.verified_addresses!.eth_addresses);
      
      if (result.circlesData.isOnCircles) {
        console.log(`✅ Found Circles profile for @${user.username}:`, {
          mainAddress: result.circlesData.mainAddress,
          signerAddress: result.circlesData.signerAddress,
          profileName: result.circlesData.profileData?.name
        });
      } else {
        console.log(`❌ No Circles profile found for @${user.username}`);
      }
      
      return { fid: user.fid, circlesData: result.circlesData, debugData: result.debugData };
    });
    
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(({ fid, circlesData, debugData }) => {
      results.set(fid, { circlesData, debugData });
    });
    
    // Add users without verified addresses as not on Circles
    users.filter(user => 
      !user.verified_addresses?.eth_addresses || user.verified_addresses.eth_addresses.length === 0
    ).forEach(user => {
      if (!results.has(user.fid)) {
        results.set(user.fid, { 
          circlesData: { isOnCircles: false },
          debugData: { addressChecks: [] }
        });
      }
    });
    
    // Delay between batches to be respectful to the API
    if (i + batchSize < usersWithAddresses.length) {
      console.log('Waiting 200ms before next batch...');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  const circlesUsers = Array.from(results.values()).filter(result => result.circlesData.isOnCircles).length;
  console.log(`=== BATCH LOOKUP COMPLETE ===`);
  console.log(`Found ${circlesUsers} users on Circles out of ${users.length} total users`);
  
  return results;
}