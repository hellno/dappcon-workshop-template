import { ImageResponse } from "next/og";

export const alt = "Your Friends on Circles";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div tw="h-full w-full flex flex-col justify-center items-center relative bg-purple-600">
        {/* Background pattern */}
        <div tw="absolute inset-0 bg-black bg-opacity-200"></div>

        {/* Main content */}
        <div tw="flex flex-col items-center text-center z-10">
          {/* Title */}
          <h1 tw="text-7xl font-bold text-white mb-4">
            Find Your Farcaster Friends
          </h1>
          <h2 tw="text-6xl font-bold text-white mb-8">on Circles</h2>
          {/* Feature highlights */}
          <div tw="flex items-center justify-center space-x-8">
            <div tw="flex items-center space-x-3">
              <div tw="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <span tw="text-2xl">👥</span>
              </div>
              <span tw="text-xl text-white">Your Friends</span>
            </div>

            <div tw="text-4xl text-white">+</div>

            <div tw="flex items-center space-x-3">
              <div tw="w-8 h-8 bg-green-400 rounded-full flex items-center justify-center">
                <span tw="text-2xl">🟠</span>
              </div>
              <span tw="text-xl text-white">Circles Status</span>
            </div>

            <div tw="text-4xl text-white">=</div>

            <div tw="flex items-center space-x-3">
              <div tw="w-8 h-8 bg-pink-400 rounded-full flex items-center justify-center">
                <span tw="text-2xl">❤️</span>
              </div>
              <span tw="text-xl text-white">Trust</span>
            </div>
          </div>
        </div>

        {/* Bottom branding */}
        <div tw="absolute bottom-6 text-white opacity-75 text-lg">
          Powered by Farcaster × Circles
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
