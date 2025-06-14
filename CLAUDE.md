# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm` - Install dependencies
- `pnpm dev` - Start development server (Next.js)
- `pnpm build` - Build production application
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

### Testing
This project uses ngrok for local testing in the Farcaster Frame Playground:
- `ngrok http http://localhost:3000` - Expose local dev server
- Access via [Warpcast Frame Playground](https://warpcast.com/~/developers/frame-playground) (mobile only)

### CLI Creation (for new projects)
- `npx @farcaster/create-mini-app` - Create new mini app with scaffolding

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
- `src/components/ui/` - Reusable UI components
- `src/lib/` - Utility functions and helpers

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