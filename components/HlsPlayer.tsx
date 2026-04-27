"use client";

import { useEffect, useRef } from "react";
import type Hls from "hls.js";

type Props = {
  src: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  poster?: string;
  onLoadedData?: () => void;
  onError?: () => void;
};

const RETRY_DELAYS = [1000, 2000, 5000, 10000, 20000];

export default function HlsPlayer({
  src,
  autoPlay = true,
  muted = true,
  controls = false,
  poster,
  onLoadedData,
  onError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let hls: Hls | null = null;
    let retryCount = 0;
    let retryTimer: number | null = null;
    const video = videoRef.current;
    if (!video || !src) return;

    const cleanup = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (hls) {
        hls.destroy();
        hls = null;
      }
    };

    const scheduleRetry = () => {
      if (retryTimer !== null) return;

      const delay =
        RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)] ?? 20000;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        retryCount += 1;
        cleanup();
        initialize();
      }, delay);
    };

    const initialize = async () => {
      if (!video) return;

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.load();
        video.play().catch(() => {});
        return;
      }

      const HlsLib = (await import("hls.js")).default;

      if (!HlsLib.isSupported()) {
        onError?.();
        return;
      }

      hls = new HlsLib({
        lowLatencyMode: false,
        maxBufferLength: 10,
        maxMaxBufferLength: 30,
        enableWorker: true,
        startFragPrefetch: true,
      });

      hls.attachMedia(video);
      hls.on(HlsLib.Events.MEDIA_ATTACHED, () => {
        hls?.loadSource(src);
      });

      hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
        retryCount = 0;
        video.play().catch(() => {});
      });

      hls.on(HlsLib.Events.ERROR, (_, data) => {
        if (!data.fatal) return;

        switch (data.type) {
          case HlsLib.ErrorTypes.NETWORK_ERROR:
            if (retryCount < RETRY_DELAYS.length) {
              scheduleRetry();
            } else {
              onError?.();
            }
            break;
          case HlsLib.ErrorTypes.MEDIA_ERROR:
            hls?.recoverMediaError();
            scheduleRetry();
            break;
          default:
            onError?.();
            break;
        }
      });
    };

    const handleVideoElementError = () => {
      if (retryCount < RETRY_DELAYS.length) {
        scheduleRetry();
      } else {
        onError?.();
      }
    };

    video.addEventListener("error", handleVideoElementError);
    initialize();

    return () => {
      video.removeEventListener("error", handleVideoElementError);
      cleanup();
    };
  }, [src, onError]);

  return (
    <video
      ref={videoRef}
      playsInline
      autoPlay={autoPlay}
      muted={muted}
      controls={controls}
      poster={poster}
      onLoadedData={onLoadedData}
      onError={onError}
      className="w-full h-full object-cover rounded-lg bg-black"
    />
  );
}