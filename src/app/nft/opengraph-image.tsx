import { ImageResponse } from "next/og";

export const alt = "Base NFT Mint";
export const size = {
  width: 600,
  height: 400,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0052FF",
          fontSize: 32,
          fontWeight: 600,
        }}
      >
        <div style={{ color: "white", marginBottom: 20 }}>🖼️</div>
        <div style={{ color: "white", textAlign: "center" }}>
          Base NFT Mint
        </div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 18, marginTop: 10 }}>
          Mint exclusive NFTs on Base
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}