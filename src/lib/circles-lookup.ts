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

interface AvatarInfo {
  avatar: string;
  tokenAddress?: string;
  avatarType?: 'human' | 'organization' | 'group';
  circlesVersion?: string;
  signupTimestamp?: number;
  profileCid?: string;
}

export interface CirclesData {
  isOnCircles: boolean;
  mainAddress?: string;
  profileData?: CirclesProfile;
  signerAddress?: string;
  avatarInfo?: AvatarInfo;
  isActiveV2?: boolean;
  isTrustedByCurrentUser?: boolean;
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
      
      // Check if user has active Circles v2 token
      const avatarInfo = await checkActiveToken(address);
      const isActiveV2 = avatarInfo && avatarInfo.tokenAddress;
      
      return {
        circlesData: {
          isOnCircles: true,
          mainAddress: address,
          profileData: direct.profileData,
          avatarInfo,
          isActiveV2: !!isActiveV2
        },
        debugData
      };
    }
    
    if (signer.exists) {
      console.log('Found main account via signer lookup for:', address, '-> main:', signer.mainAddress);
      
      // Check if main address has active Circles v2 token
      const avatarInfo = signer.mainAddress ? await checkActiveToken(signer.mainAddress) : undefined;
      const isActiveV2 = avatarInfo && avatarInfo.tokenAddress;
      
      return {
        circlesData: {
          isOnCircles: true,
          mainAddress: signer.mainAddress,
          profileData: signer.profileData,
          signerAddress: address,
          avatarInfo,
          isActiveV2: !!isActiveV2
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

// Direct profile lookup function
async function directCirclesProfileLookup(address: string) {
  try {
    const url = `https://rpc.aboutcircles.com/profiles/search?address=${address}`;
    console.log(`🔍 Direct profile lookup for: ${address}`);
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
}

// Check if user is active on Circles v2 by looking for CrcV2_RegisterHuman event (99% more efficient)
async function checkActiveCirclesToken(address: string): Promise<AvatarInfo | undefined> {
  try {
    console.log(`🔍 Checking for Circles v2 registration: ${address}`);
    
    const response = await fetch("https://rpc.aboutcircles.com", {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "circles_events",
        params: [address, 0, null]
      })
    });
    
    console.log(`📡 Registration check response status: ${response.status}`);
    
    if (!response.ok) {
      console.log(`❌ Registration check request failed: ${response.status} ${response.statusText}`);
      return undefined;
    }
    
    const data = await response.json();
    
    if (data.result && Array.isArray(data.result) && data.result.length > 0) {
      // Look for CrcV2_RegisterHuman event - the definitive active v2 user indicator
      const registerEvent = data.result.find((event: any) => 
        event.event === 'CrcV2_RegisterHuman'
      );
      
      if (registerEvent) {
        console.log(`✅ Found Circles v2 registration for ${address}`);
        
        // Determine avatar type based on events
        let avatarType: 'human' | 'organization' | 'group' = 'human';
        if (data.result.some((e: any) => e.event?.includes('Group'))) {
          avatarType = 'group';
        } else if (data.result.some((e: any) => e.event?.includes('Organization'))) {
          avatarType = 'organization';
        }
        
        return {
          avatar: address,
          tokenAddress: address,
          avatarType,
          circlesVersion: 'v2',
          signupTimestamp: registerEvent.values?.timestamp ? parseInt(registerEvent.values.timestamp, 16) : undefined
        };
      } else {
        // Fallback: check for any CrcV2_* events (backup method for edge cases)
        const hasV2Activity = data.result.some((event: any) => 
          event.event?.startsWith('CrcV2_')
        );
        
        if (hasV2Activity) {
          console.log(`✅ Found Circles v2 activity for ${address} (no RegisterHuman but has v2 events)`);
          
          const firstV2Event = data.result.find((event: any) => 
            event.event?.startsWith('CrcV2_')
          );
          
          return {
            avatar: address,
            tokenAddress: address,
            avatarType: 'human', // Default for fallback
            circlesVersion: 'v2',
            signupTimestamp: firstV2Event?.values?.timestamp ? parseInt(firstV2Event.values.timestamp, 16) : undefined
          };
        } else {
          console.log(`❌ No Circles v2 registration or activity found for ${address}`);
        }
      }
    } else {
      console.log(`❌ No events found for ${address}`);
    }
  } catch (error) {
    console.log(`💥 Registration check failed for ${address}:`, error);
  }
  
  return undefined;
}

// Get current user's trust relationships (who they trust)
async function getCurrentUserTrustList(currentUserAddress: string): Promise<Set<string>> {
  try {
    console.log(`🔍 Getting trust list for current user: ${currentUserAddress}`);
    
    const response = await fetch("https://rpc.aboutcircles.com", {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "circles_events",
        params: [currentUserAddress, 0, null]
      })
    });
    
    if (!response.ok) {
      console.log(`❌ Trust list request failed: ${response.status} ${response.statusText}`);
      return new Set();
    }
    
    const data = await response.json();
    
    if (data.result && Array.isArray(data.result)) {
      // Find all CrcV2_Trust events where current user is the truster
      const trustEvents = data.result.filter((event: any) => 
        event.event === 'CrcV2_Trust' && 
        event.values?.truster?.toLowerCase() === currentUserAddress.toLowerCase()
      );
      
      // Extract unique trustee addresses
      const trustedAddresses = new Set(
        trustEvents
          .map((event: any) => event.values?.trustee?.toLowerCase())
          .filter(Boolean)
      );
      
      console.log(`✅ Found ${trustedAddresses.size} trusted addresses for ${currentUserAddress}`);
      return trustedAddresses;
    }
    
    return new Set();
  } catch (error) {
    console.log(`💥 Trust list lookup failed for ${currentUserAddress}:`, error);
    return new Set();
  }
}

// Use cache only in production builds
const getCurrentUserTrusts = process.env.NODE_ENV === 'production'
  ? unstable_cache(
      getCurrentUserTrustList,
      ['user-trust-list'],
      { revalidate: 3600, tags: ['circles-trust'] } // 1 hour cache (trust changes more frequently)
    )
  : getCurrentUserTrustList;

// Use cache only in production builds
const checkActiveToken = process.env.NODE_ENV === 'production'
  ? unstable_cache(
      checkActiveCirclesToken,
      ['active-token-lookup'],
      { revalidate: 86400, tags: ['circles-token'] }
    )
  : checkActiveCirclesToken;

// Use cache only in production builds
const checkDirectCirclesProfile = process.env.NODE_ENV === 'production' 
  ? unstable_cache(
      directCirclesProfileLookup,
      ['direct-circles-profile'],
      { revalidate: 86400, tags: ['circles-profile'] }
    )
  : directCirclesProfileLookup;

// Signer to main account lookup function
async function signerToMainAccountLookup(signerAddress: string) {
  try {
    console.log(`🔍 Checking signer events for: ${signerAddress}`);
    
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
}

// Use cache only in production builds
const checkSignerToMainAccount = process.env.NODE_ENV === 'production'
  ? unstable_cache(
      signerToMainAccountLookup,
      ['signer-circles-lookup'],
      { revalidate: 86400, tags: ['circles-signer'] }
    )
  : signerToMainAccountLookup;

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
  const batchSize = 8; // Increased batch size for better performance
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
    
    // Reduced delay for better UX
    if (i + batchSize < usersWithAddresses.length) {
      console.log('Waiting 100ms before next batch...');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
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
  
  const circlesUsers = Array.from(results.values()).filter(result => result.circlesData.isOnCircles).length;
  console.log(`=== BATCH LOOKUP COMPLETE ===`);
  console.log(`Found ${circlesUsers} users on Circles out of ${users.length} total users`);
  
  return results;
}

// Streaming version for progressive UI updates with trust relationship checking
export async function* streamCirclesStatus(
  users: Array<{ fid: number; username: string; verified_addresses?: { eth_addresses: string[] } }>,
  currentUserAddresses?: string[]
): AsyncGenerator<{ fid: number; circlesData: CirclesData; progress: { completed: number; total: number } }> {
  console.log('=== STARTING STREAMING CIRCLES LOOKUP ===');
  console.log('Total users to check:', users.length);
  
  // Get current user's trust relationships if provided
  let currentUserTrusts = new Set<string>();
  if (currentUserAddresses && currentUserAddresses.length > 0) {
    // Get trust list for the first active Circles address
    for (const address of currentUserAddresses) {
      const trusts = await getCurrentUserTrusts(address);
      if (trusts.size > 0) {
        currentUserTrusts = trusts;
        console.log('Found trust list for current user:', address, 'trusts:', trusts.size, 'addresses');
        break;
      }
    }
  }
  
  // Filter users that have verified addresses
  const usersWithAddresses = users.filter(user => 
    user.verified_addresses?.eth_addresses && user.verified_addresses.eth_addresses.length > 0
  );
  
  const usersWithoutAddresses = users.filter(user => 
    !user.verified_addresses?.eth_addresses || user.verified_addresses.eth_addresses.length === 0
  );
  
  console.log('Users with verified addresses:', usersWithAddresses.length);
  console.log('Users without verified addresses:', usersWithoutAddresses.length);
  
  let completed = 0;
  const total = users.length;
  
  // First, yield users without addresses (instant)
  for (const user of usersWithoutAddresses) {
    completed++;
    yield {
      fid: user.fid,
      circlesData: { isOnCircles: false },
      progress: { completed, total }
    };
  }
  
  // Process users with addresses in batches
  const batchSize = 8;
  for (let i = 0; i < usersWithAddresses.length; i += batchSize) {
    const batch = usersWithAddresses.slice(i, i + batchSize);
    
    console.log(`Processing streaming batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(usersWithAddresses.length / batchSize)}`);
    
    const batchPromises = batch.map(async (user) => {
      const result = await checkCirclesStatusWithDebug(user.verified_addresses!.eth_addresses);
      
      // Check if this user is trusted by current user
      let isTrustedByCurrentUser = false;
      if (result.circlesData.isOnCircles && result.circlesData.mainAddress) {
        isTrustedByCurrentUser = currentUserTrusts.has(result.circlesData.mainAddress.toLowerCase());
      }
      
      return { 
        fid: user.fid, 
        circlesData: {
          ...result.circlesData,
          isTrustedByCurrentUser
        }
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    
    // Yield each result as it completes
    for (const result of batchResults) {
      completed++;
      yield {
        ...result,
        progress: { completed, total }
      };
    }
    
    // Small delay between batches
    if (i + batchSize < usersWithAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`=== STREAMING LOOKUP COMPLETE ===`);
}