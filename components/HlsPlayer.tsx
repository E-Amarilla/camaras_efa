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

// Watchdog: si currentTime no avanza durante FROZEN_TICKS × WATCHDOG_INTERVAL_MS → recarga
const WATCHDOG_INTERVAL_MS = 4000;
const FROZEN_TICKS_THRESHOLD = 3; // 12 segundos sin progreso

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
    let watchdogTimer: number | null = null;
    let lastCurrentTime = -1;
    let frozenTicks = 0;
    // Contador de generación: invalida callbacks async pendientes cuando se recarga
    let generation = 0;

    const video = videoRef.current;
    if (!video || !src) return;

    const cleanup = () => {
      generation++;
      if (watchdogTimer !== null) {
        window.clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
      if (hls) {
        hls.destroy();
        hls = null;
      }
    };

    const reload = () => {
      cleanup();
      lastCurrentTime = -1;
      frozenTicks = 0;
      initialize();
    };

    const startWatchdog = () => {
      if (watchdogTimer !== null) return;
      watchdogTimer = window.setInterval(() => {
        // Solo vigilar si el video debería estar reproduciendo
        if (!video || video.paused || video.ended || video.readyState < 2) return;
        const t = video.currentTime;
        if (t === lastCurrentTime) {
          frozenTicks++;
          if (frozenTicks >= FROZEN_TICKS_THRESHOLD) {
            reload();
          }
        } else {
          lastCurrentTime = t;
          frozenTicks = 0;
        }
      }, WATCHDOG_INTERVAL_MS);
    };

    const initialize = async () => {
      const myGen = generation;
      if (!video) return;

      // Soporte nativo HLS (Safari / iOS): no usa HLS.js
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        if (myGen !== generation) return;
        video.src = src;
        video.load();
        video.play().catch(() => {});
        startWatchdog();
        return;
      }

      const HlsLib = (await import("hls.js")).default;
      // Verificar que no se haya recargado mientras se importaba hls.js
      if (myGen !== generation) return;

      if (!HlsLib.isSupported()) {
        onError?.();
        return;
      }

      hls = new HlsLib({
        lowLatencyMode: false,
        enableWorker: true,
        startFragPrefetch: false,

        // Buffer generoso para streams en vivo: evita stalls por carga lenta
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        // Limitar el back-buffer: evita que Chrome acumule memoria indefinidamente
        // en streams de cámaras que corren durante horas
        backBufferLength: 30,

        // Si el player cae más de 10 segmentos detrás del borde vivo, HLS.js
        // salta automáticamente a liveSyncPosition (fundamental tras throttling)
        liveMaxLatencyDurationCount: 10,

        // Tolerancia a huecos de timestamps entre segmentos (común en DVR Hikvision)
        maxBufferHole: 0.5,
      });

      hls.attachMedia(video);

      hls.on(HlsLib.Events.MEDIA_ATTACHED, () => {
        hls?.loadSource(src);
      });

      hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        startWatchdog();
      });

      hls.on(HlsLib.Events.ERROR, (_, data) => {
        if (!data.fatal) return;

        switch (data.type) {
          case HlsLib.ErrorTypes.MEDIA_ERROR:
            // recoverMediaError resetea el MediaSource de Chrome; si no funciona,
            // el watchdog detectará que currentTime no avanza y llamará reload()
            hls?.recoverMediaError();
            break;
          default:
            // Error de red fatal u otro error irrecuperable: recargar el stream.
            // Per docs de HLS.js: llamar startLoad() tras un NETWORK_ERROR fatal
            // causa loop de carga; la única solución correcta es una recarga limpia.
            reload();
            break;
        }
      });
    };

    // Chrome throttlea las tabs en background (timers a 1 Hz mínimo).
    // Al volver al tab, los streams pueden estar congelados: recargar todos.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reload();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    initialize();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
      className="w-full h-full object-cover rounded-lg bg-black"
    />
  );
}