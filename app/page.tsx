"use client";

import React, { useEffect, useMemo } from "react";
import { useNetwork } from "@/contexts/NetworkContext";
import CameraCard from "@/components/CameraCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Camera } from "@/types";

function saveAuthFromUrl() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  let saved = false;
  const access_token = params.get("access_token");
  const role = params.get("role");
  const token_type = params.get("token_type");
  if (access_token && role && token_type) {
    const userData = {
      access_token,
      role,
      token_type,
    };
    sessionStorage.setItem("user_data", JSON.stringify(userData));
    saved = true;
  }

  const userDataParam = params.get("userData");
  if (userDataParam) {
    try {
      const userData = JSON.parse(
        decodeURIComponent(decodeURIComponent(userDataParam))
      );
      sessionStorage.setItem("user_data", JSON.stringify(userData));
      saved = true;
    } catch {}
  }
  if (saved) {
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.reload();
    return true;
  }
  return false;
}

function getUserDataFromSession() {
  if (typeof window === "undefined") return null;
  const data = sessionStorage.getItem("user_data");
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export default function Page() {
  const { redirectURL, mediaMTXBaseURL, isLoading } = useNetwork();

  useEffect(() => {
    const justSaved = saveAuthFromUrl();
    if (justSaved) return;
    const userData = getUserDataFromSession();
    if (!userData || !userData.access_token || !userData.role) {
      if (redirectURL) {
        window.location.href = redirectURL;
      }
    }
  }, [redirectURL]);

  const cameras: Camera[] = useMemo(() => {
    if (!mediaMTXBaseURL) return [];

    return ["cam1", "cam2", "cam3", "cam4"].map((id) => ({
      id,
      url: `${mediaMTXBaseURL}/${id}/index.m3u8`,
    }));
  }, [mediaMTXBaseURL]);

  if (isLoading || !mediaMTXBaseURL) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex-1 p-5">
      <div className="w-full h-full">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 h-full w-full items-center justify-center">
          {cameras.map((camera) => (
            <CameraCard key={camera.id} camera={camera} />
          ))}
        </div>
      </div>
    </div>
  );
}