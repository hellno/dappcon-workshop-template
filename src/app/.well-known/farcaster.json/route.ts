export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_URL;
  const config = {
    accountAssociation: {
      header:
        "eyJmaWQiOjEzNTk2LCJ0eXBlIjoiY3VzdG9keSIsImtleSI6IjB4ODE3MzE4RDZmRkY2NkExOGQ4M0ExMzc2QTc2RjZlMzBCNDNjODg4OSJ9",
      payload: "eyJkb21haW4iOiJkYXBwY29uLWNpcmNsZXMtZGVtby52ZXJjZWwuYXBwIn0",
      signature:
        "MHgzZGFjZDYxNTUwNzRkMzdhZDkzNmI1OWY5M2FkMzQzYTA0N2Q0NDU2OWI2ZDdhZDM3MWNlYWZhMjRkODM1YjRlMDE2YWFkZDBjYTg1MDQyZTQxZDM0YjAwNjU4NWZiNzQ0NjFmMzAwNDUyYTk3ZTBkZWQ5M2NjNzExNmY4Yjc5YTFi",
    },
    frame: {
      version: "1",
      name: "DappCon Circles Demo",
      subtitle: "find farcaster friends on circles",
      tagline: "find farcaster friends on circles",
      description: "help you find farcaster friends on circles",
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/opengraph-image`,
      buttonTitle: "Launch",
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
      webhookUrl: `${appUrl}/api/webhook`,
      primaryCategory: "productivity",
      tags: ["circles", "friends", "gnosis", "social"],
    },
  };

  return Response.json(config);
}
