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
    const video = videoRef.current;
    if (!video || !src) return;

    const setup = async () => {
      // Fallback nativo para Safari
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.play().catch(() => {});
        return;
      }

      const HlsLib = (await import("hls.js")).default;

      if (!HlsLib.isSupported()) {
        onError?.();
        return;
      }

      hls = new HlsLib({
        // MediaMTX no produce LL-HLS; lowLatencyMode: true causa fallos en Chrome
        lowLatencyMode: false,
        maxBufferLength: 10,
        maxMaxBufferLength: 30,
        enableWorker: true,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      // Manejo de errores: Chrome corta en cualquier error fatal; Firefox recupera solo.
      hls.on(HlsLib.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case HlsLib.ErrorTypes.NETWORK_ERROR:
            // Reintentar carga de red (p.ej. segmento no disponible aún)
            hls?.startLoad();
            break;
          case HlsLib.ErrorTypes.MEDIA_ERROR:
            // Recuperar codec/decodificador sin reiniciar la conexión
            hls?.recoverMediaError();
            break;
          default:
            // Error irrecuperable: notificar al padre
            onError?.();
            break;
        }
      });
    };

    setup();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (hls) {
          hls.destroy();
          hls = null;
        }
        video.src = "";
        setup();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (hls) hls.destroy();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [src]);

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