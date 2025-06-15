# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm` - Install dependencies
- `pnpm dev` - Start development server (Next.js)
- `pnpm build` - Build production application (⚠️ **DO NOT run while dev server is active**)
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Check TypeScript without building (safe during development)

### Safe Development Validation
When `pnpm dev` is running, use these commands to validate your code without conflicts:
- `pnpm lint` - Safe to run alongside dev server
- `pnpm type-check` - TypeScript validation without build conflicts
- `pnpm validate` - Combined type-checking and linting (recommended)
- Test in browser at `http://localhost:3000` - Live development testing

### Production Validation
To test production builds, **stop the dev server first**:
```bash
# Stop dev server (Ctrl+C)
pnpm build    # Now safe to build
pnpm start    # Test production build
```

### Testing
This project uses ngrok for local testing in the Farcaster Frame Playground:
- `ngrok http http://localhost:3000` - Expose local dev server
- Access via [Warpcast Frame Playground](https://warpcast.com/~/developers/frame-playground) (mobile only)

### CLI Creation (for new projects)
- `npx @farcaster/create-mini-app` - Create new mini app with scaffolding

## Development Workflow

### Recommended Development Process

1. **Start Development Mode**
   ```bash
   pnpm dev
   ```
   - Runs Next.js in development mode with hot reload
   - Available at `http://localhost:3000`
   - Leave this running throughout development

2. **Validate Code During Development**
   While dev server is running, use these safe commands:
   ```bash
   pnpm lint        # Check code style and rules
   pnpm type-check  # Verify TypeScript without building
   pnpm validate    # Run both lint and type-check together
   ```

3. **Test Production Build** (when needed)
   ```bash
   # Stop dev server first (Ctrl+C or Cmd+C)
   pnpm build       # Build for production
   pnpm start       # Test production build
   # Restart dev when done: pnpm dev
   ```

### ⚠️ Critical Workflow Notes

- **NEVER run `pnpm build` while `pnpm dev` is active**
  - Causes file system conflicts in `.next` directory
  - Can break both processes and require cleanup
  - Use `pnpm type-check` instead for validation

- **Use `pnpm validate` for quick checks**
  - Combines TypeScript and linting validation
  - Safe to run alongside development server
  - Faster than full production build

### Troubleshooting Development Issues

**If dev server becomes unresponsive:**
1. Stop the dev server (Ctrl+C)
2. Clear Next.js cache: `rm -rf .next`
3. Restart: `pnpm dev`

**If port 3000 is occupied:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
# Or start on different port
pnpm dev -p 3001
```

**If TypeScript errors persist:**
1. Restart TypeScript server in your editor
2. Run `pnpm type-check` to see all errors
3. Clear `.next` directory if needed

## Architecture

### Farcaster Frame SDK Integration
This is a Farcaster Mini App (Frames v2) built with Next.js. The core architecture centers around:

- **Frame SDK**: Uses `@farcaster/frame-sdk` for Farcaster interactions
- **Dynamic Imports**: Required for client-side components due to SDK's browser dependencies
- **Provider Pattern**: Wraps app with Wagmi + Solana providers for wallet connectivity

### Key Components

#### SDK Initialization
- All frame functionality requires calling `sdk.actions.ready()` after component mount
- Uses `useEffect` hook with `isSDKLoaded` state to prevent double initialization
- Context data available via `await sdk.context` containing user info

#### Wallet Integration
- **Ethereum**: Uses Wagmi with `@farcaster/frame-wagmi-connector`
- **Solana**: Uses `@farcaster/mini-app-solana` package
- Supports multiple chains: Base, Optimism, Mainnet, Degen, Unichain

#### Frame Structure
- **Layout**: Implements safe area insets from frame context
- **Width**: Fixed 300px width for mobile frame compatibility
- **Dynamic Loading**: Components using SDK must be dynamically imported with `ssr: false`

### Directory Structure
- `src/app/frames/` - Frame-specific routes (hello, haptics, token)
- `src/components/providers/` - Wallet and context providers
- `src/components/ui/` - Reusable UI components (shadcn/ui)
- `src/components/` - Custom components
- `src/lib/` - Utility functions and helpers

### Available Custom Components

#### UI Components
- **Toast Notifications** - Uses Sonner for elegant toast messages
  - Success toasts for successful operations (mint, metadata loading)
  - Error toasts for failures with detailed descriptions
  - Configured in root layout with proper theming
  - Available globally via `toast` from "sonner"

#### NFT Components
- **`NFTCard`** (`nft-card.tsx`) - Displays NFT with metadata from contract
  - Supports all chains via viem
  - Intelligent metadata fetching with fallbacks:
    - Primary: `tokenURI(tokenId)` for individual NFT metadata
    - Fallback: `contractURI()` or `contractUri()` for collection metadata
  - Smart image URL processing:
    - Handles IPFS URLs conversion (`ipfs://` → `https://ipfs.io/ipfs/`)
    - Fixes malformed IPFS URLs (e.g., `ipfs.io/ipfs/https://...`)
    - Extracts actual URLs from incorrectly formatted metadata
  - Robust RPC handling:
    - Uses configured Alchemy endpoints when available (Base mainnet)
    - Automatic retry logic with exponential backoff for rate limits
    - Handles rate limit errors (HTTP 429) gracefully
  - Props: contractAddress, tokenId, network, layout options
  - Handles loading states, error handling, and edge cases
  
- **`NFTMintFlow`** (`nft-mint-flow.tsx`) - Complete NFT minting workflow with UI
  - Sheet-based UI for minting process
  - Intelligent price detection with multiple fallbacks:
    - Primary: `mintPrice()`, `price()`, `MINT_PRICE()`, `getMintPrice()`
    - Fallback: `protocolFee()` + `mintFee(amount)` for fee-based contracts
  - Automatic network switching:
    - Detects chain mismatches before minting
    - Automatically switches to target network
    - Graceful error handling with manual switch option
  - Handles both per-NFT pricing and amount-aware fee calculation
  - Wallet connection via Farcaster Frame
  - Transaction status tracking and comprehensive error handling
  - Props: amount, chainId, contractAddress, callbacks

#### Frame Management Components
- **`AddMiniappButton`** (`add-miniapp-button.tsx`) - Add mini app to user's client
  - Uses `useMiniAppSdk` hook for state management
  - Shows saved state with visual feedback
  - Customizable text and styling

#### Other Components
- **`ShareCastButton`** (`share-cast-button.tsx`) - Share content as Farcaster cast

### Component Usage Guidelines

#### Using NFT Components
When working with NFTs, always prefer the existing components:

1. **For displaying NFTs**: Use `NFTCard` component
   ```tsx
   <NFTCard
     contractAddress="0x..."
     tokenId="1"
     network="base"
     showTitle={true}
     showNetwork={true}
     onLoad={(metadata) => console.log(metadata)}
   />
   ```

2. **For minting NFTs**: Use `NFTMintFlow` component
   ```tsx
   <NFTMintFlow
     amount={1}
     chainId={8453} // Base mainnet
     contractAddress="0x..."
     buttonText="Mint NFT"
     onMintSuccess={(txHash) => console.log("Success:", txHash)}
     onMintError={(error) => console.error("Error:", error)}
   />
   ```

3. **For adding mini apps**: Use `AddMiniappButton` component
   ```tsx
   <AddMiniappButton 
     text="Add App"
     textDone="Added"
     className="w-full"
   />
   ```

#### SDK Hook Usage
Always use `useMiniAppSdk()` hook for frame functionality:
- Provides `context`, `sdk`, `isSDKLoaded`, `isMiniAppSaved`, etc.
- Handles SDK initialization and cleanup automatically
- Use `isSDKLoaded` before rendering SDK-dependent content

### AI Development Guidelines

When working with Claude Code or other AI assistants:

1. **Before making changes**: Always mention if `pnpm dev` is running
2. **For code validation**: Use `pnpm validate` instead of `pnpm build`
3. **For testing changes**: Use the development server at `http://localhost:3000`
4. **Production testing**: Only when specifically needed, and stop dev server first

**Recommended AI workflow:**
```bash
# Keep this running during development
pnpm dev

# Use this for validation (safe with dev server)
pnpm validate

# Only use build when specifically testing production
# (Stop dev server first!)
pnpm build
```

### Frame Actions
The SDK provides several action types:
- `openUrl()` - Opens external URLs
- `close()` - Closes frame
- `addFrame()` - Adds frame to user's client
- `composeCast()` - Opens cast composer with text and embeds
- `viewProfile()` - Opens user profile by FID
- `quickAuth()` - Handles authentication and JWT generation
- Haptic feedback support for enhanced mobile experience

### State Management
- Uses React hooks for local state
- Context passed from Farcaster client provides user data
- Event listeners for frame lifecycle events (frameAdded, frameRemoved, etc.)

## Development Notes

### Client-Side Requirements
- Mark components using SDK with `"use client"`
- Use dynamic imports for SDK-dependent components
- Handle loading states before SDK initialization

### Authentication
- Context data from Farcaster is currently unauthenticated in preview
- QuickAuth provides JWT tokens for authenticated endpoints
- Custom endpoints at `/api/me` and `/api/send-notification`

### Testing
- Use ngrok to expose local development server
- Test in Warpcast mobile app Frame Playground
- Monitor console logs for SDK events and errors

## Manifest Requirements

Mini apps must host a manifest at `/.well-known/farcaster.json` containing:
- **Account Association**: Cryptographic proof of domain ownership
- **Frame Metadata**: Name, icon, splash image, home URL
- **Capabilities**: Required permissions and features

## Context Detection

Mini apps can detect launch context:
- Cast embed launch
- Notification launch  
- Profile page launch
- Direct URL access

Context provides user information, client details, and launch parameters.

## Security Notes

- Context data is currently unauthenticated in preview
- Implement proper JWT validation for authenticated endpoints
- Follow security best practices for wallet interactions
- Validate all user inputs and external data

## Workshop Resources

- See `docs/farcaster-miniapps-llm-guide.txt` for comprehensive Mini Apps documentation
- Follow tutorial in README.md for step-by-step implementation
- Use demo components in `src/components/Demo.tsx` as reference examples

### Coding Conventions
Follow the conventions outlined in CONVENTIONS.md, emphasizing:
- Simplicity and clarity
- Descriptive naming
- Small, focused functions
- Consistent patterns throughout the codebase