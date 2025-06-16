export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_URL;
  const config = {
    accountAssociation: {
      header:
        "eyJmaWQiOjEzNTk2LCJ0eXBlIjoiY3VzdG9keSIsImtleSI6IjB4ODE3MzE4RDZmRkY2NkExOGQ4M0ExMzc2QTc2RjZlMzBCNDNjODg4OSJ9",
      payload:
        "eyJkb21haW4iOiJkYXBwY29uLXdvcmtzaG9wLXRlbXBsYXRlLnZlcmNlbC5hcHAifQ",
      signature:
        "MHg0M2ZhZTNlMTk1ZjU0ZDlmMmVlOTM2OGQyN2JjNDIxNGNlODdkOWYyYmE0ZGQxYjg0NGYxOWRiNzMwYTMwNWEyMDljY2E3MDczYThkYjVlMjFiNWJlNTY3N2VkNjIwOTEwZTFkZTRhOGM3MzczZWRkMzUxZTZhNWYwYzA3ZmZjNjFj",
    },
    frame: {
      version: "1",
      name: "DappCon Mini App Template",
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/frames/hello/opengraph-image`,
      buttonTitle: "Launch Frame",
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
      webhookUrl: `${appUrl}/api/webhook`,
    },
  };

  return Response.json(config);
}
