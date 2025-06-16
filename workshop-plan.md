# Farcaster × Circles Integration Workshop Plan

## Architecture Overview

```
Farcaster Mini App → Neynar API → Circles SDK
       |                 |            |
   User FID         Following List  User Check
       |                 |            |
       └──────────────────|────────────┘
                         ▼
                  Combined Display
                     (UI Cards)
```

**Data Flow:**
1. Get user's FID from Farcaster context
2. Fetch following list from Neynar API
3. Check each user's Circles status
4. Display combined results with actions

## Product Requirements Document (PRD)

### Objective
Create a Farcaster Mini App that displays who a user follows and their Circles protocol status, with optional integration to Metri.xyz for trust interactions.

### User Stories

**Primary Flow:**
- As a Farcaster user, I want to see who I follow on Farcaster
- As a Circles user, I want to know which of my Farcaster follows are also on Circles
- As a user, I want to quickly identify potential trust connections

**Stretch Goal:**
- As a user, I want to open Metri.xyz profiles to trust other users

### Technical Requirements

#### APIs & SDKs Used:
1. **Neynar API**: `/v2/farcaster/following/`
   - Fetch user's following list
   - Requires API key and user FID

2. **Circles SDK**: User existence check
   - Initialize SDK connection
   - Query user profiles by address/username

3. **Metri.xyz Integration**: Deep linking
   - Open user profiles for trust actions
   - Format: `https://app.metri.xyz/[address]`

#### Data Flow:
1. Get current user's FID from Farcaster context
2. Call Neynar API to fetch following list
3. For each followed user, check Circles presence
4. Display combined results with action buttons

### UI Components Required:
- Following list with user cards
- Circles status indicators (badge/icon)
- Metri.xyz action buttons
- Loading states and error handling

## Workshop Implementation Steps
### Core Implementation

#### Step 1: Create Following List Component
- [ ] Create `src/components/FollowingList.tsx`
- [ ] Add Farcaster context integration
- [ ] Implement user FID extraction

#### Step 2: Integrate Neynar API
- [ ] Create API service function
- [ ] Fetch user following data
- [ ] Handle pagination (optional)
- [ ] Add error handling

#### Step 3: Add Circles Integration
- [ ] Initialize Circles SDK
- [ ] Create user existence check function
- [ ] Map Farcaster users to Circles status

#### Step 4: Build UI Components
- [ ] Design user card component
- [ ] Add Circles status badges
- [ ] Implement loading states

### Stretch Implementation (2 minutes)

#### Step 5: Metri.xyz Integration
- [ ] Add "Open in Metri" buttons
- [ ] Implement deep linking
- [ ] Handle app detection/fallback

## Fallback Plans

**If Circles SDK issues:**
- Mock Circles data with static responses
- Focus on Neynar integration and UI patterns

**If time constraints:**
- Simplify to basic following list
- Add Circles badges without full SDK integration
- Skip Metri.xyz stretch goal

## Resources for Participants

### Documentation Links:
- [Neynar API Docs](https://docs.neynar.com/reference/fetch-user-following)
- [Circles SDK Docs](https://docs.aboutcircles.com/developer-docs/getting-started-with-the-sdk)
- [Farcaster Mini Apps Guide](https://docs.farcaster.xyz/learn/what-is-farcaster/frames)

### Code Examples:
- Neynar API integration patterns
- Circles SDK initialization
- Error handling best practices
- Mobile-responsive Frame UI components

## Success Metrics
- [ ] App displays user's following list
- [ ] Circles status shown for each user
- [ ] Clean mobile UI within Frame constraints
- [ ] Error states handled gracefully
- [ ] (Stretch) Metri.xyz integration working

---

## 🎯 BREAKTHROUGH: Complete Address Resolution Solution

### Problem Solved
**Core Issue**: Circles users have main addresses (Gnosis Safes) but we often only know their signer addresses (EOAs from ENS/Farcaster). The Circles profile API only works with main addresses.

**Solution**: Multi-strategy lookup using Circles Nethermind plugin's `circles_events` RPC method.

### Research Findings

#### Circles API Capabilities
1. **Profile API**: `https://rpc.aboutcircles.com/profiles/search?address={address}`
   - Only works with main Circles addresses (Gnosis Safes)
   - Returns profile data: name, description, avatar, etc.

2. **Circles Nethermind Plugin**: `https://rpc.aboutcircles.com`
   - Custom RPC methods: `circles_events`, `circles_query`, `circles_getTokenBalances`
   - **Key Discovery**: `circles_events(address, fromBlock, toBlock)` returns ALL events for an address
   - Includes `Safe_AddedOwner` events when address becomes a Safe owner

#### Address Relationship Discovery
```bash
# Test that revealed the solution:
curl -X POST "https://rpc.aboutcircles.com" -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "circles_events",
  "params": ["0xee324c588ceF1BF1c1360883E4318834af66366d", 0, null]
}'
```

**Result**: Showed `Safe_AddedOwner` events linking signer to main Circles account:
- Signer: `0xee324c588ceF1BF1c1360883E4318834af66366d` (timdaub.eth)
- Main Account: `0x051e8680774a0611d4729ad04c26026f9f90667b` (has Circles profile)

### Implementation Strategy

#### Multi-Strategy Address Resolution

**Strategy 1: Direct Lookup**
```typescript
const directUrl = `https://rpc.aboutcircles.com/profiles/search?address=${address}`;
const response = await fetch(directUrl);
// Returns profile if address is main Circles account
```

**Strategy 2: Signer Reverse Lookup**
```typescript
// Step 1: Get all events for the address
const eventsResponse = await fetch("https://rpc.aboutcircles.com", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "circles_events",
    params: [address, 0, null]
  })
});

// Step 2: Filter for Safe_AddedOwner events
const ownerEvents = eventsData.result.filter(event =>
  event.event === "Safe_AddedOwner" &&
  event.values.owner.toLowerCase() === address.toLowerCase()
);

// Step 3: Extract Safe addresses and check for Circles profiles
const safeAddresses = ownerEvents.map(event => event.values.safeAddress);
for (const safeAddress of safeAddresses) {
  const safeProfileUrl = `https://rpc.aboutcircles.com/profiles/search?address=${safeAddress}`;
  // Check if this Safe has a Circles profile
}
```

**Strategy 3: ENS Resolution** (via wagmi)
```typescript
const { data: ensAddress } = useEnsAddress({
  name: isENS ? address : undefined,
  enabled: isENS && address.length > 0,
});
// Then apply strategies 1 & 2 to resolved address
```

### Complete Implementation

#### ENS + Circles Integration
```typescript
// 1. ENS Resolution
let resolvedAddress = address;
if (isENSName) {
  if (!ensAddress) throw new Error("ENS name not found");
  resolvedAddress = ensAddress;
}

// 2. Multi-strategy Circles lookup
const isRegistered = await checkUserExists(sdk, resolvedAddress);
const profileData = await fetchProfileData(sdk, resolvedAddress);
```

#### Key Functions

**checkUserExists()**
- Strategy 1: Direct profile API call
- Strategy 2: circles_events → Safe_AddedOwner → profile check
- Returns: boolean (found via any strategy)

**fetchProfileData()**
- Strategy 1: Direct profile lookup
- Strategy 2: Signer lookup → main account profile
- Returns: Profile object with main account data

### Technical Dependencies

#### Required Packages
```bash
pnpm add @circles-sdk/sdk @circles-sdk/adapter-ethers @circles-sdk/pathfinder
```

#### Provider Setup
```typescript
// CirclesSdkProvider.tsx - Dynamic import required
const CirclesSDK = dynamic(
  () => import("~/components/providers/CirclesSdkProvider").then(mod => ({ default: mod.CirclesSDK })),
  { ssr: false }
);
```

### Workshop Integration

#### Updated Data Flow
```
ENS/Address Input → ENS Resolution → Multi-Strategy Circles Lookup → Profile Display
                                   ↓
                              1. Direct API call
                              2. circles_events → Safe lookup
                              3. Return main account profile
```

#### Test Cases
- ✅ `timdaub.eth` → resolves → signer lookup → finds main account profile
- ✅ `0x051e8680774a0611D4729AD04c26026f9F90667b` → direct lookup → profile found
- ✅ `0xee324c588ceF1BF1c1360883E4318834af66366d` → signer lookup → main account found

### Production-Ready Features
- Real ENS resolution via wagmi
- Real Circles API integration
- Comprehensive error handling
- Detailed console logging for debugging
- Multi-strategy fallback system
- Returns actual profile data from main accounts

This solution completely solves the signer-to-main-account mapping problem and provides a robust foundation for the workshop demo.
