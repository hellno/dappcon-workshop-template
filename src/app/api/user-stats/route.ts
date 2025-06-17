import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import { NextRequest } from "next/server";

const config = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY || "",
});
const neynarClient = new NeynarAPIClient(config);

export async function GET(request: NextRequest) {
  try {
    console.log("User stats API called");

    const searchParams = request.nextUrl.searchParams;
    const fidParam = searchParams.get("fid");

    console.log("FID parameter:", fidParam);

    if (!fidParam) {
      console.log("Missing FID parameter");
      return Response.json(
        { message: "Missing fid parameter" },
        { status: 400 },
      );
    }

    const fid = Number(fidParam);
    console.log("Fetching user stats for FID:", fid);

    // Check if Neynar API key is configured
    if (!process.env.NEYNAR_API_KEY) {
      console.error("NEYNAR_API_KEY environment variable is not set");
      return Response.json(
        { message: "Neynar API key not configured" },
        { status: 500 },
      );
    }

    // Get user data with follower/following counts
    const users = await neynarClient.fetchBulkUsers({ fids: [fid] });

    if (!users.users || users.users.length === 0) {
      return Response.json(
        { message: "User not found" },
        { status: 404 },
      );
    }

    const user = users.users[0];
    console.log("User stats retrieved:", {
      fid: user.fid,
      follower_count: user.follower_count,
      following_count: user.following_count,
    });

    return Response.json({
      fid: user.fid,
      follower_count: user.follower_count || 0,
      following_count: user.following_count || 0,
      username: user.username,
      display_name: user.display_name,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);

    // Enhanced logging for API errors
    if (error && typeof error === "object" && "response" in error) {
      const apiError = error as {
        status?: number;
        message: string;
        response?: {
          status?: number;
          data?: unknown;
        };
      };
      console.error("=== NEYNAR API ERROR ===");
      console.error("Status:", apiError.status);
      console.error("Response:", apiError.response?.data);

      return Response.json(
        {
          message: "Neynar API Error",
          error: apiError.message,
          status: apiError.status,
        },
        { status: apiError.status || 500 },
      );
    }

    return Response.json(
      {
        message: "Failed to fetch user stats",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}