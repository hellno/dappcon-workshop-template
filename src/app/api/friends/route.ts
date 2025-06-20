import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("Friends API called");

    const searchParams = request.nextUrl.searchParams;

    const fidParam = searchParams.get("fid");
    const cursorParam = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");

    console.log("FID parameter:", fidParam);
    console.log("Cursor parameter:", cursorParam);
    console.log("Limit parameter:", limitParam);

    if (!fidParam) {
      console.log("Missing FID parameter");
      return Response.json(
        { message: "Missing fid parameter" },
        { status: 400 },
      );
    }

    const fid = Number(fidParam);
    const limit = limitParam ? Math.min(Number(limitParam), 150) : 100; // Cap at 150 per request
    console.log("Parsed FID:", fid, "Limit:", limit);

    // Check if Neynar API key is configured
    if (!process.env.NEYNAR_API_KEY) {
      console.error("NEYNAR_API_KEY environment variable is not set");
      return Response.json(
        { message: "Neynar API key not configured" },
        { status: 500 },
      );
    }

    console.log("Fetching following for FID:", fid);

    // Fetch from Neynar v2 endpoint
    const url = new URL("https://api.neynar.com/v2/farcaster/following/");
    url.searchParams.set("fid", fid.toString());
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("sort_type", "desc_chron");
    if (cursorParam) {
      url.searchParams.set("cursor", cursorParam);
    }
    const apiRes = await fetch(url.toString(), {
      method: "GET",
      headers: { "x-api-key": process.env.NEYNAR_API_KEY || "" },
    });
    if (!apiRes.ok) {
      throw new Error(`Neynar v2 API error: ${apiRes.status}`);
    }
    const data = await apiRes.json();
    console.log("Following data received, count:", data.following?.length ?? 0);
    console.log("Has next page:", data.next?.cursor != null);

    // Extract the user data from the response and unwrap follow envelopes
    const rawFriends = data.following ?? data.users ?? [];
    const followingUsers = rawFriends.map((item: any) => item.user ?? item);

    return Response.json({
      friends: followingUsers,
      stats: {
        following: followingUsers.length,
      },
      pagination: {
        nextCursor: data.next?.cursor || null,
        hasMore: data.next?.cursor != null,
      },
    });
  } catch (error) {
    console.error("Error fetching friends:", error);

    // Enhanced logging for API errors
    if (error && typeof error === "object" && "response" in error) {
      const apiError = error as {
        status?: number;
        message: string;
        response?: {
          status?: number;
          data?: unknown;
          headers?: unknown;
        };
        config?: {
          url?: string;
          method?: string;
          headers?: unknown;
          data?: unknown;
          params?: unknown;
        };
      };
      console.error("=== NEYNAR API ERROR DETAILS ===");
      console.error("Status:", apiError.status);
      console.error("Status Code:", apiError.response?.status);
      console.error("Response Data:", apiError.response?.data);
      console.error("Response Headers:", apiError.response?.headers);
      console.error("Request URL:", apiError.config?.url);
      console.error("Request Method:", apiError.config?.method);
      console.error("Request Headers:", apiError.config?.headers);
      console.error("Request Data:", apiError.config?.data);
      console.error("Request Params:", apiError.config?.params);
      console.error("=== END NEYNAR API ERROR ===");

      return Response.json(
        {
          message: "Neynar API Error",
          error: apiError.message,
          status: apiError.status,
          apiResponse: apiError.response?.data,
          requestUrl: apiError.config?.url,
          requestParams: apiError.config?.params,
        },
        { status: apiError.status || 500 },
      );
    }

    // Log other error types
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    return Response.json(
      {
        message: "Failed to fetch friends",
        error: error instanceof Error ? error.message : "Unknown error",
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: 500 },
    );
  }
}
