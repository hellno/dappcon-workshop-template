import { ImageResponse } from "next/og";

export const alt = "DappCon Mini App Template - Build Farcaster Mini Apps";
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
          background:
            "linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #3730a3 100%)",
          padding: "32px",
          position: "relative",
        }}
      >
        {/* Background decorative elements */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            width: "32px",
            height: "32px",
            background: "#fbbf24",
            borderRadius: "50%",
            opacity: 0.8,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            width: "24px",
            height: "24px",
            background: "#f472b6",
            borderRadius: "50%",
            opacity: 0.6,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50px",
            left: "50px",
            width: "16px",
            height: "16px",
            background: "#34d399",
            borderRadius: "50%",
            opacity: 0.5,
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            zIndex: 10,
          }}
        >
          {/* Main title */}
          <h1
            style={{
              fontSize: "48px",
              fontWeight: "bold",
              color: "white",
              marginBottom: "12px",
              letterSpacing: "-0.025em",
              margin: "0 0 12px 0",
            }}
          >
            DappCon
          </h1>
          <h2
            style={{
              fontSize: "32px",
              fontWeight: "600",
              color: "#bfdbfe",
              marginBottom: "16px",
              margin: "0 0 16px 0",
            }}
          >
            Mini App Workshop
          </h2>

          {/* Subtitle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255, 255, 255, 0.2)",
              borderRadius: "50px",
              padding: "12px 24px",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                fontSize: "20px",
                color: "white",
                fontWeight: "500",
              }}
            >
              Build Farcaster Mini Apps
            </span>
          </div>

          {/* Feature badges */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                background: "linear-gradient(90deg, #10b981 0%, #3b82f6 100%)",
                color: "white",
                padding: "8px 16px",
                borderRadius: "50px",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              16.06.2025
            </div>
            <div
              style={{
                background: "linear-gradient(90deg, #f472b6 0%, #a855f7 100%)",
                color: "white",
                padding: "8px 16px",
                borderRadius: "50px",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              hellno.eth
            </div>
            <div
              style={{
                background: "linear-gradient(90deg, #fbbf24 0%, #ef4444 100%)",
                color: "white",
                padding: "8px 16px",
                borderRadius: "50px",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              Berlin
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
