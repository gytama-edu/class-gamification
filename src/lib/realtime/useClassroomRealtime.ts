import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabase/client";

export type RealtimeStatus = "Live" | "Connecting" | "Reconnecting" | "Offline";

export function useClassroomRealtime(
  classId: string | null,
  onUpdate: () => void,
) {
  const [status, setStatus] = useState<RealtimeStatus>("Connecting");

  const isMock = import.meta.env.VITE_DATA_SOURCE !== "supabase";

  useEffect(() => {
    if (!classId) {
      setStatus("Offline");
      return;
    }

    let isMounted = true;
    let timeoutId: any;

    const debouncedUpdate = () => {
      if (!isMounted) return;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (isMounted) onUpdate();
      }, 500); // Wait 500ms before refetching to bundle rapid events
    };

    if (isMock) {
      setStatus("Live");
      // Use BroadcastChannel or storage event for mock mode tab sync
      const channelName = `class-room:${classId}`;
      let bc: BroadcastChannel | null = null;

      try {
        bc = new BroadcastChannel(channelName);
        bc.onmessage = (event) => {
          if (event.data.type === "REFRESH") {
            debouncedUpdate();
          }
        };
      } catch (err) {
        // Fallback to storage events if BroadcastChannel not supported
        const handleStorage = (e: StorageEvent) => {
          if (e.key === `sync:${channelName}`) {
            debouncedUpdate();
          }
        };
        window.addEventListener("storage", handleStorage);
        return () => {
          isMounted = false;
          if (timeoutId) clearTimeout(timeoutId);
          window.removeEventListener("storage", handleStorage);
        };
      }

      return () => {
        isMounted = false;
        if (timeoutId) clearTimeout(timeoutId);
        bc?.close();
      };
    }

    // Supabase Mode
    if (!supabase) {
      setStatus("Offline");
      return;
    }

    setStatus("Connecting");

    const channel = supabase
      .channel(`class-room:${classId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "classes",
          filter: `id=eq.${classId}`,
        },
        debouncedUpdate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "students",
          filter: `class_id=eq.${classId}`,
        },
        debouncedUpdate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meetings",
          filter: `class_id=eq.${classId}`,
        },
        debouncedUpdate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "point_events",
          filter: `class_id=eq.${classId}`,
        },
        debouncedUpdate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "life_events",
          filter: `class_id=eq.${classId}`,
        },
        debouncedUpdate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_meeting_states" },
        debouncedUpdate,
      )
      .subscribe((status, err) => {
        if (!isMounted) return;
        if (status === "SUBSCRIBED") {
          setStatus("Live");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setStatus("Offline");
          console.error("Realtime error:", err);
        } else if (status === "CLOSED") {
          setStatus("Offline");
        } else {
          setStatus("Reconnecting");
        }
      });

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [classId, isMock, onUpdate]);

  return { status };
}

export function notifyMockUpdate(classId: string) {
  const isMock = import.meta.env.VITE_DATA_SOURCE !== "supabase";
  if (!isMock) return;

  const channelName = `class-room:${classId}`;
  try {
    const bc = new BroadcastChannel(channelName);
    bc.postMessage({ type: "REFRESH" });
    bc.close();
  } catch (err) {
    localStorage.setItem(`sync:${channelName}`, Date.now().toString());
  }
}
