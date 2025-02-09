"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import Image from "next/image";
import { 
  DAILY_ALLOWANCE,
  NEYNAR_API_KEY,
  NEYNAR_CLIENT_ID,
  START_DATE,
  END_DATE
} from "~/lib/constants";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";

import { config } from "~/components/providers/WagmiProvider";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, optimism } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE } from "~/lib/constants";

function NutTrackerCard({ context }: { context: Context.FrameContext }) {
  const { data: session } = useSession();
  const [nutStats, setNutStats] = useState({
    sent: 0,
    received: 0,
    failedAttempts: 0,
    totalPoints: 0,
    dailyUsed: 0,
    dailyRemaining: DAILY_ALLOWANCE
  });
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const calculateDailyAllowance = useCallback(() => {
    const now = new Date();
    const resetTime = new Date(now);
    resetTime.setUTCHours(11, 0, 0, 0);
    if (now > resetTime) resetTime.setDate(resetTime.getDate() + 1);
    
    const timeLeft = resetTime.getTime() - now.getTime();
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
      remaining: DAILY_ALLOWANCE - nutStats.dailyUsed,
      resetIn: `${hoursLeft}h ${minutesLeft}m`
    };
  }, [nutStats.dailyUsed]);

  const fetchNutStats = useCallback(async (fid: number) => {
    try {
      setIsLoading(true);
      const response = await fetch(`https://api.neynar.com/v2/farcaster/feed?feed_type=filter&filter_type=fids&fids=${fid}`, {
        headers: {
          'api_key': NEYNAR_API_KEY,
          'client_id': NEYNAR_CLIENT_ID
        }
      });
      
      const data = await response.json();
      const nutCasts = data.casts.filter((cast: any) => 
        cast.text.includes('🥜') && 
        new Date(cast.timestamp) >= START_DATE &&
        new Date(cast.timestamp) <= END_DATE
      );

      const received = nutCasts.filter((cast: any) => 
        cast.parent_author?.fid === fid
      ).length;

      const sent = nutCasts.length - received;
      const failedAttempts = Math.max(0, sent - DAILY_ALLOWANCE);
      const dailyUsed = Math.min(sent, DAILY_ALLOWANCE);

      setNutStats({
        sent,
        received,
        failedAttempts,
        totalPoints: received,
        dailyUsed,
        dailyRemaining: DAILY_ALLOWANCE - dailyUsed
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError("Failed to fetch nut stats. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const fid = session?.user?.fid || context.requester.fid;
      if (fid) fetchNutStats(fid);
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchNutStats, session, context]);

  const daily = calculateDailyAllowance();

  return (
    <Card className="bg-gradient-to-br from-purple-900 to-blue-900 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-3xl">🥜</span>
          Nut Tracking Stats
        </CardTitle>
        <CardDescription className="text-gray-300">
          Tracking since Feb 1, 2025 - Updated: {lastUpdated.toLocaleTimeString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="text-red-400">{error}</div>}
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-purple-200">Your Profile</Label>
            <div className="flex items-center gap-3">
              <Image 
                src={context.requester.pfpUrl}
                alt="Profile"
                width={40}
                height={40}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-medium">FID: {context.requesterFid}</p>
                <p className="text-sm text-purple-300">
                  {context.requester.displayName}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-purple-200">🥜 Points</Label>
            <div className="text-2xl font-bold text-yellow-400">
              {nutStats.totalPoints}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-white/10 rounded-lg">
            <p className="text-sm text-purple-200">Sent</p>
            <p className="text-xl">{nutStats.sent}</p>
          </div>
          <div className="p-3 bg-white/10 rounded-lg">
            <p className="text-sm text-purple-200">Received</p>
            <p className="text-xl">{nutStats.received}</p>
          </div>
          <div className="p-3 bg-white/10 rounded-lg">
            <p className="text-sm text-purple-200">Daily Left</p>
            <p className="text-xl">{daily.remaining}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => sdk.actions.button({ buttonIndex: 1 })}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            🥜 State
          </button>
          <button
            onClick={() => sdk.actions.share({
              text: `Check my 🥜 stats: ${nutStats.totalPoints} points!`,
              url: window.location.href
            })}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Share It
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();

  const [added, setAdded] = useState(false);

  const [addFrameResult, setAddFrameResult] = useState("");

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      if (!context) {
        return;
      }

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
        addFrame();
      }

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setAdded(true);
      });

      sdk.on("frameAddRejected", ({ reason }) => {
        console.log("frameAddRejected", reason);
      });

      sdk.on("frameRemoved", () => {
        console.log("frameRemoved");
        setAdded(false);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("notificationsEnabled", notificationDetails);
      });
      sdk.on("notificationsDisabled", () => {
        console.log("notificationsDisabled");
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });

      console.log("Calling ready");
      sdk.actions.ready({});

      // Set up a MIPD Store, and request Providers.
      const store = createStore();

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      });
    };
    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[300px] mx-auto py-2 px-2">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-700 dark:text-gray-300">
          {PROJECT_TITLE}
        </h1>
        <NutTrackerCard context={context} />
      </div>
    </div>
  );
}
