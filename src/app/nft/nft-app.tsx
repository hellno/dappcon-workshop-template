"use client";

import dynamic from "next/dynamic";
import ReactDOM from "react-dom";

const NFTDisplay = dynamic(() => import("~/components/NFTDisplay"), {
  ssr: false,
});

export default function NFTApp() {
  ReactDOM.preconnect("https://auth.farcaster.xyz");

  return <NFTDisplay />;
}