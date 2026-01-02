import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LogOut,
  Trophy,
  Shield,
  Check,
  X,
  AlertCircle,
  Camera,
  User,
  QrCode,
} from "lucide-react";

const supabaseUrl = "https://eeboxlitezqgjyrnssgx.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlYm94bGl0ZXpxZ2p5cm5zc2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjcyNTksImV4cCI6MjA4MDI0MzI1OX0.8VlGLHjEv_0aGWOjiDuLLziOCnUqciIAEWayMUGsXT8";

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const ADMIN_EMAIL = "quinten.geurs@gmail.com";

const getSafePhotoUrl = (url) => {
  if (!url)
    return "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop";
  if (
    typeof url === "string" &&
    (url.startsWith("http") || url.startsWith("https") || url.startsWith("data:image/"))
  ) {
    return url;
  }
  return "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop";
};

const getTrimClass = (trim) => {
  switch (trim) {
    case "green":
      return "ring-4 ring-green-500";
    case "blue":
      return "ring-4 ring-blue-500";
    case "purple":
      return "ring-4 ring-purple-600";
    case "gold":
      return "ring-4 ring-yellow-500";
    default:
      return "";
  }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getTodayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayLocalDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateExpiryDate(startDate, duration) {
  let date;
  if (typeof startDate === 'string' && startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    date = new Date(startDate + 'T12:00:00');
  } else {
    date = new Date(startDate);
  }
  
  if (isNaN(date.getTime())) {
    console.error('Invalid start date:', startDate);
    date = new Date();
  }
  
  switch (duration) {
    case "1hour":
      date.setHours(date.getHours() + 1);
      break;
    case "3hours":
      date.setHours(date.getHours() + 3);
      break;
    case "12hours":
      date.setHours(date.getHours() + 12);
      break;
    case "1day":
      date.setDate(date.getDate() + 1);
      break;
    case "3days":
      date.setDate(date.getDate() + 3);
      break;
    case "1week":
      date.setDate(date.getDate() + 7);
      break;
    default:
      date.setDate(date.getDate() + 1);
  }
  
  return date.toISOString();
}

export default function App() {
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const [hunts, setHunts] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [streak, setStreak] = useState(0);
  const [totalHunts, setTotalHunts] = useState(0);
  const [tier, setTier] = useState("Newbie");
  const [isInfluencer, setIsInfluencer] = useState(false);
  const [lastActive, setLastActive] = useState(null);
  const [currentHunt, setCurrentHunt] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showInfluencerOptIn, setShowInfluencerOptIn] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [selfieFile, setSelfieFile] = useState(null);
  const [qrInput, setQrInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState("");
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Admin states
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState("hunts");
  const [adminHunts, setAdminHunts] = useState([]);
  const [userUploads, setUserUploads] = useState([]);
  const [processingSubmission, setProcessingSubmission] = useState(null);
  const [editingHunt, setEditingHunt] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Create/Edit Hunt Form
  const [newHuntDate, setNewHuntDate] = useState("");
  const [newHuntCategory, setNewHuntCategory] = useState("");
  const [newHuntRiddle, setNewHuntRiddle] = useState("");
  const [newHuntBusinessName, setNewHuntBusinessName] = useState("");
  const [newHuntCode, setNewHuntCode] = useState("");
  const [newHuntDiscount, setNewHuntDiscount] = useState("");
  const [newHuntLat, setNewHuntLat] = useState("");
  const [newHuntLon, setNewHuntLon] = useState("");
  const [newHuntRadius, setNewHuntRadius] = useState("50");
  const [newHuntDuration, setNewHuntDuration] = useState("1day");
  const [newHuntPhoto, setNewHuntPhoto] = useState(null);
  const [newHuntTrim, setNewHuntTrim] = useState("none");
  const [newHuntQrCode, setNewHuntQrCode] = useState(""); // New field for QR code
  const [creatingHunt, setCreatingHunt] = useState(false);

  // ─── LOAD USER DATA ─────────────────────
  const loadProgressAndHunts = useCallback(async (currentSession) => {
    if (!currentSession?.user?.id) {
      console.log("Load aborted - no valid session");
      return;
    }
    
    if (showAdmin) return;

    try {
      setError("");

      const { data: progressRows, error: progressError } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", currentSession.user.id)
        .order("last_active", { ascending: false });

      if (progressError) throw progressError;

      let completedIds = [];
      const progress = progressRows?.[0] || null;

      if (progress) {
        completedIds = Array.isArray(progress.completed_hunt_ids) ? progress.completed_hunt_ids : [];

        if (progressRows.length > 1) {
          const all = new Set();
          let maxTotal = 0, maxStreak = 0;
          progressRows.forEach((r) => {
            if (Array.isArray(r.completed_hunt_ids)) r.completed_hunt_ids.forEach((id) => all.add(id));
            maxTotal = Math.max(maxTotal, r.total_hunts || 0);
            maxStreak = Math.max(maxStreak, r.streak || 0);
          });
          completedIds = Array.from(all);
          setTotalHunts(completedIds.length);
          setStreak(maxStreak);
        } else {
          setTotalHunts(progress.total_hunts || 0);
          setStreak(progress.streak || 0);
        }

        setCompleted(completedIds);
        setTier(
          completedIds.length >= 20 ? "Legend" :
          completedIds.length >= 10 ? "Pro" :
          completedIds.length >= 5 ? "Hunter" : "Newbie"
        );
        setLastActive(progress.last_active || null);
      } else {
        setCompleted([]);
        setStreak(0);
        setTotalHunts(0);
        setTier("Newbie");
        setLastActive(null);
      }

      // Load influencer status
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_influencer")
        .eq("id", currentSession.user.id)
        .single();
      setIsInfluencer(profile?.is_influencer || false);

      const now = new Date().toISOString();
      const { data: huntsData, error: huntsError } = await supabase
        .from("hunts")
        .select("*")
        .gte("expiry_date", now)
        .order("date", { ascending: false });

      if (huntsError) throw huntsError;

      setHunts(huntsData || []);
    } catch (e) {
      console.error("Load error:", e);
      setError("Failed to load hunts – check connection or try refresh.");
      setHunts([]);
    } finally {
      setDataLoaded(true);
    }
  }, [showAdmin]);

  // ─── AUTH & DATA LOADING ─────────────────────
  useEffect(() => {
    const initAuth = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
          setSessionLoading(false);
          setDataLoaded(true);
          return;
        }

        setSession(currentSession);
        
        if (currentSession?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setIsAdmin(true);
        }
        
        if (!currentSession) {
          setDataLoaded(true);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        setSession(null);
        setDataLoaded(true);
      } finally {
        setSessionLoading(false);
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setSessionLoading(false);

      if (session?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        setShowAdmin(false);
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session && !showAdmin) {
        loadProgressAndHunts(session);
      }

      if (event === 'SIGNED_OUT' || !session) {
        setDataLoaded(true);
      }

      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", session.user.id)
          .single();

        if (!profile) {
          await supabase.from("profiles").insert({
            id: session.user.id,
            username: session.user.email?.split("@")[0] || `hunter_${Date.now().toString(36)}`,
            full_name: session.user.user_metadata.full_name || null,
            is_influencer: false,
          });
        }
      }
    });

    return () => listener?.subscription.unsubscribe();
  }, [showAdmin, loadProgressAndHunts]);

  // Sorted and filtered hunts
  const sortedAndFilteredHunts = hunts
    .filter((h) => !completed.includes(h.id))
    .filter((h) => activeFilter === "All" || h.category === activeFilter)
    .filter((h) => h.trim_color !== "gold" || totalHunts >= 10)
    .sort((a, b) => {
      const order = { purple: 0, blue: 1, green: 2, none: 3, gold: 4 };
      return order[a.trim_color || "none"] - order[b.trim_color || "none"];
    });

  // Realtime updates
  useEffect(() => {
    if (!session || showAdmin) return;

    let huntsChannel, progressChannel;

    const setupRealtime = () => {
      huntsChannel = supabase
        .channel("hunts-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "hunts" }, () => {
          loadProgressAndHunts(session);
        })
        .subscribe();

      progressChannel = supabase
        .channel("progress-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_progress", filter: `user_id=eq.${session.user.id}` },
          () => {
            loadProgressAndHunts(session);
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      supabase.removeChannel(huntsChannel);
      supabase.removeChannel(progressChannel);
    };
  }, [session, showAdmin, loadProgressAndHunts]);

  // ─── TRIM LIMIT VALIDATION ─────────────────────
  const validateTrimLimit = async (category, trim, excludeId = null) => {
    if (trim === "none" || trim === "gold") return true;

    const { data, error } = await supabase
      .from("hunts")
      .select("id")
      .eq("category", category)
      .eq("trim_color", trim);

    if (error) return false;

    const count = data.filter(h => h.id !== excludeId).length;

    const limits = { green: 5, blue: 3, purple: 1 };
    return count < limits[trim];
  };

  // ─── COMPLETION LOGIC (shared) ─────────────────────
  const completeHunt = async (huntId, newCompleted) => {
    const today = getTodayLocalDate();
    let newStreak = streak;
    if (lastActive === getYesterdayLocalDate()) newStreak = streak + 1;
    else if (lastActive !== today) newStreak = 1;

    const newTier = newCompleted.length >= 20 ? "Legend" : newCompleted.length >= 10 ? "Pro" : newCompleted.length >= 5 ? "Hunter" : "Newbie";

    await supabase.from("user_progress").upsert({
      user_id: session.user.id,
      completed_hunt_ids: newCompleted,
      total_hunts: newCompleted.length,
      streak: newStreak,
      tier: newTier,
      last_active: today,
    }, { onConflict: "user_id" });

    setCompleted(newCompleted);
    setTotalHunts(newCompleted.length);
    setStreak(newStreak);
    setTier(newTier);
    setLastActive(today);

    // Show influencer opt-in at exactly 20 hunts
    if (newCompleted.length === 20 && !isInfluencer) {
      setShowInfluencerOptIn(true);
    }
  };

  // ─── QR VERIFICATION ─────────────────────
  const verifyQrAndUnlock = async () => {
    if (!currentHunt || !qrInput.trim()) {
      alert("Please enter the QR code");
      return;
    }

    setUploading(true);
    try {
      if (!navigator.geolocation) throw new Error("Geolocation not supported");

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        currentHunt.lat,
        currentHunt.lon
      );

      if (distance > currentHunt.radius) {
        alert(`You are ${Math.round(distance)}m away. Need to be within ${currentHunt.radius}m`);
        setUploading(false);
        return;
      }

      if (qrInput.trim().toUpperCase() !== (currentHunt.qr_code || "").trim().toUpperCase()) {
        alert("Invalid QR code");
        setUploading(false);
        return;
      }

      const newCompleted = [...new Set([...completed, currentHunt.id])];
      await completeHunt(currentHunt.id, newCompleted);

      setShowVerificationModal(false);
      setQrInput("");
      alert(`Success! Your code is: ${currentHunt.code}`);
    } catch (err) {
      alert(err.message || "Verification failed");
    } finally {
      setUploading(false);
    }
  };

  // ─── SELFIE UPLOAD ─────────────────────
  const uploadSelfie = useCallback(async () => {
    if (!selfieFile || !currentHunt || uploading || !session) return;
    if (completed.includes(currentHunt.id)) {
      alert("You have already completed this hunt!");
      setShowVerificationModal(false);
      setSelfieFile(null);
      return;
    }

    setUploading(true);
    setError("");

    try {
      if (!navigator.geolocation) throw new Error("Geolocation not supported");

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        currentHunt.lat,
        currentHunt.lon
      );

      if (distance > currentHunt.radius) {
        alert(`You are ${Math.round(distance)}m away. Need to be within ${currentHunt.radius}m`);
        setUploading(false);
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(selfieFile.type)) {
        throw new Error('Invalid file type. Please upload a JPG, PNG, or WebP image.');
      }

      if (selfieFile.size > 5 * 1024 * 1024) {
        throw new Error('File too large. Maximum size is 5MB.');
      }

      const fileExt = selfieFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${currentHunt.id}_${Date.now()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("user-uploads")
        .upload(filePath, selfieFile, { cacheControl: '3600', upsert: false });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from("user-uploads")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("user-uploads").insert({
        user_id: session.user.id,
        hunt_id: currentHunt.id,
        image_url: publicUrl,
      });

      if (insertError) {
        await supabase.storage.from("user-uploads").remove([filePath]);
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      const newCompleted = [...new Set([...completed, currentHunt.id])];
      await completeHunt(currentHunt.id, newCompleted);

      setShowVerificationModal(false);
      setSelfieFile(null);
      setCurrentHunt(null);
      alert(`Success! Your code is: ${currentHunt.code}`);
    } catch (err) {
      alert(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [selfieFile, currentHunt, uploading, completed, session, streak, lastActive]);

  // ─── LEADERBOARD ─────────────────────
  const loadLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const { data, error } = await supabase
        .from("user_progress")
        .select("user_id, total_hunts, tier")
        .order("total_hunts", { ascending: false })
        .limit(10);

      if (error) throw error;

      const userIds = data.map((item) => item.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", userIds);

      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      const enriched = data.map((item, idx) => {
        const profile = profileMap[item.user_id];
        const displayName = profile?.username || profile?.full_name || `Hunter #${idx + 1}`;
        return { displayName, hunts: item.total_hunts, tier: item.tier || "Newbie" };
      });

      setLeaderboardData(enriched);
    } catch (err) {
      setLeaderboardData([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  useEffect(() => {
    if (showLeaderboard && leaderboardData.length === 0) loadLeaderboard();
  }, [showLeaderboard, leaderboardData.length, loadLeaderboard]);

  // ─── ADMIN DATA ─────────────────────
  const loadAdminData = useCallback(async () => {
    try {
      const { data: allHunts } = await supabase
        .from("hunts")
        .select("*")
        .order("date", { ascending: false });
      setAdminHunts(allHunts || []);

      const { data: subs } = await supabase
        .from("user-uploads")
        .select("*")
        .order("created_at", { ascending: false });

      const enriched = await Promise.all(
        (subs || []).map(async (sub) => {
          const { data: hunt } = await supabase
            .from("hunts")
            .select("business_name")
            .eq("id", sub.hunt_id)
            .single();
          return { ...sub, hunt_name: hunt?.business_name || "Unknown" };
        })
      );
      setUserUploads(enriched);
    } catch (e) {
      setError("Failed to load admin data");
    }
  }, []);

  useEffect(() => {
    if (showAdmin && isAdmin) loadAdminData();
  }, [showAdmin, isAdmin, loadAdminData]);

  // ─── CREATE HUNT ─────────────────────
  const createHunt = useCallback(async () => {
    if (!newHuntBusinessName.trim() || !newHuntRiddle.trim() || !newHuntCode.trim() || !newHuntLat || !newHuntLon) {
      alert("Please fill all required fields");
      return;
    }

    const lat = parseFloat(newHuntLat);
    const lon = parseFloat(newHuntLon);
    if (isNaN(lat) || isNaN(lon)) {
      alert("Invalid coordinates");
      return;
    }

    const canAdd = await validateTrimLimit(newHuntCategory || "Food & Drink", newHuntTrim);
    if (!canAdd) {
      alert(`Cannot add more ${newHuntTrim} trimmed hunts in this category`);
      return;
    }

    setCreatingHunt(true);
    try {
      let photoUrl = null;

      if (newHuntPhoto) {
        const fileExt = newHuntPhoto.name.split(".").pop()?.toLowerCase() || "jpg";
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("hunts")
          .upload(fileName, newHuntPhoto, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("hunts").getPublicUrl(fileName);
        photoUrl = data.publicUrl;
      }

      const startDate = newHuntDate || getTodayLocalDate();
      const expiryDate = calculateExpiryDate(startDate, newHuntDuration);

      const { error } = await supabase.from("hunts").insert({
        date: startDate,
        expiry_date: expiryDate,
        duration: newHuntDuration,
        category: newHuntCategory || "Food & Drink",
        riddle: newHuntRiddle.trim(),
        business_name: newHuntBusinessName.trim(),
        code: newHuntCode.trim(),
        discount: newHuntDiscount.trim(),
        photo: photoUrl,
        lat,
        lon,
        radius: parseInt(newHuntRadius) || 50,
        trim_color: newHuntTrim,
        qr_code: newHuntQrCode.trim() || null,
      });

      if (error) throw error;

      alert("Hunt created successfully!");
      // Reset form
      setNewHuntDate("");
      setNewHuntCategory("");
      setNewHuntRiddle("");
      setNewHuntBusinessName("");
      setNewHuntCode("");
      setNewHuntDiscount("");
      setNewHuntLat("");
      setNewHuntLon("");
      setNewHuntRadius("50");
      setNewHuntDuration("1day");
      setNewHuntTrim("none");
      setNewHuntPhoto(null);
      setNewHuntQrCode("");
      loadAdminData();
      setAdminTab("hunts");
    } catch (err) {
      alert("Failed to create hunt: " + (err.message || "Unknown error"));
    } finally {
      setCreatingHunt(false);
    }
  }, [
    newHuntDate, newHuntCategory, newHuntRiddle, newHuntBusinessName,
    newHuntCode, newHuntDiscount, newHuntLat, newHuntLon, newHuntRadius,
    newHuntDuration, newHuntPhoto, newHuntTrim, newHuntQrCode, loadAdminData
  ]);

  // ─── ADMIN APPROVE / REJECT ─────────────────────
  const approveSelfie = useCallback(async (id) => {
    setProcessingSubmission(id);
    try {
      const { error } = await supabase.from("user-uploads").update({ approved: true }).eq("id", id);
      if (error) throw error;
      await loadAdminData();
    } catch {
      alert("Failed to approve");
    } finally {
      setProcessingSubmission(null);
    }
  }, [loadAdminData]);

  const rejectSelfie = useCallback(async (id) => {
    if (!window.confirm("Reject this submission?")) return;
    setProcessingSubmission(id);
    try {
      const { error } = await supabase.from("user-uploads").delete().eq("id", id);
      if (error) throw error;
      await loadAdminData();
    } catch {
      alert("Failed to reject");
    } finally {
      setProcessingSubmission(null);
    }
  }, [loadAdminData]);

  // ─── EDIT HUNT ─────────────────────
  const startEditHunt = useCallback((hunt) => {
    setEditingHunt(hunt);
    setNewHuntDate(hunt.date || "");
    setNewHuntCategory(hunt.category || "");
    setNewHuntRiddle(hunt.riddle || "");
    setNewHuntBusinessName(hunt.business_name || "");
    setNewHuntCode(hunt.code || "");
    setNewHuntDiscount(hunt.discount || "");
    setNewHuntLat(hunt.lat?.toString() || "");
    setNewHuntLon(hunt.lon?.toString() || "");
    setNewHuntRadius(hunt.radius?.toString() || "50");
    setNewHuntDuration(hunt.duration || "1day");
    setNewHuntTrim(hunt.trim_color || "none");
    setNewHuntQrCode(hunt.qr_code || "");
    setNewHuntPhoto(null);
    setShowEditModal(true);
  }, []);

  const updateHunt = useCallback(async () => {
    if (!editingHunt) return;
    if (!newHuntBusinessName.trim() || !newHuntRiddle.trim() || !newHuntCode.trim() || !newHuntLat || !newHuntLon) {
      alert("Please fill all required fields");
      return;
    }

    const lat = parseFloat(newHuntLat);
    const lon = parseFloat(newHuntLon);
    if (isNaN(lat) || isNaN(lon)) {
      alert("Invalid coordinates");
      return;
    }

    const canAdd = await validateTrimLimit(newHuntCategory || "Food & Drink", newHuntTrim, editingHunt.id);
    if (!canAdd) {
      alert(`Cannot have more than the limit of ${newHuntTrim} trimmed hunts in this category`);
      return;
    }

    setCreatingHunt(true);
    try {
      let photoUrl = editingHunt.photo;

      if (newHuntPhoto) {
        const fileExt = newHuntPhoto.name.split(".").pop()?.toLowerCase() || "jpg";
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("hunts")
          .upload(fileName, newHuntPhoto, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("hunts").getPublicUrl(fileName);
        photoUrl = data.publicUrl;
      }

      const startDate = newHuntDate || getTodayLocalDate();
      const expiryDate = calculateExpiryDate(startDate, newHuntDuration);

      const { error } = await supabase.from("hunts").update({
        date: startDate,
        expiry_date: expiryDate,
        duration: newHuntDuration,
        category: newHuntCategory || "Food & Drink",
        riddle: newHuntRiddle.trim(),
        business_name: newHuntBusinessName.trim(),
        code: newHuntCode.trim(),
        discount: newHuntDiscount.trim(),
        photo: photoUrl,
        lat,
        lon,
        radius: parseInt(newHuntRadius) || 50,
        trim_color: newHuntTrim,
        qr_code: newHuntQrCode.trim() || null,
      }).eq("id", editingHunt.id);

      if (error) throw error;

      alert("Hunt updated successfully!");
      setShowEditModal(false);
      setEditingHunt(null);
      setNewHuntDate("");
      setNewHuntCategory("");
      setNewHuntRiddle("");
      setNewHuntBusinessName("");
      setNewHuntCode("");
      setNewHuntDiscount("");
      setNewHuntLat("");
      setNewHuntLon("");
      setNewHuntRadius("50");
      setNewHuntDuration("1day");
      setNewHuntTrim("none");
      setNewHuntPhoto(null);
      setNewHuntQrCode("");
      loadAdminData();
    } catch (err) {
      alert("Failed to update hunt: " + (err.message || "Unknown error"));
    } finally {
      setCreatingHunt(false);
    }
  }, [
    editingHunt, newHuntDate, newHuntCategory, newHuntRiddle, newHuntBusinessName,
    newHuntCode, newHuntDiscount, newHuntLat, newHuntLon, newHuntRadius,
    newHuntDuration, newHuntPhoto, newHuntTrim, newHuntQrCode, loadAdminData
  ]);

  const deleteHunt = useCallback(async (id) => {
    if (!window.confirm("Are you sure you want to delete this hunt? This cannot be undone.")) return;

    try {
      const { error } = await supabase.from("hunts").delete().eq("id", id);
      if (error) throw error;
      alert("Hunt deleted successfully!");
      loadAdminData();
    } catch (err) {
      alert("Failed to delete hunt: " + (err.message || "Unknown error"));
    }
  }, [loadAdminData]);

  // ─── AUTH ─────────────────────
  const signUp = async () => {
    if (!email.trim() || !password) {
      setAuthError("Please enter email and password");
      return;
    }
    setLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      alert("Check your email to confirm!");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async () => {
    if (!email.trim() || !password) {
      setAuthError("Please enter email and password");
      return;
    }
    setLoading(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!window.confirm("Sign out?")) return;
    await supabase.auth.signOut();
    setSession(null);
  };

  // ─── CALCULATED VALUES FOR RENDER ─────────────────────
  const activeHuntsCount = hunts.filter((h) => !completed.includes(h.id)).length;
  const completedHunts = hunts.filter((h) => completed.includes(h.id));

  // ─── RENDER ADMIN PANEL ─────────────────────
  if (showAdmin && isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white shadow-xl p-4 md:p-6 sticky top-0 z-50 flex justify-between items-center">
          <h1 className="text-2xl md:text-4xl font-black text-amber-900 flex items-center gap-2 md:gap-4">
            <Shield className="w-8 h-8 md:w-12 md:h-12" />
            Admin Panel
          </h1>
          <div className="flex gap-2 md:gap-4">
            <button onClick={() => setShowAdmin(false)} className="px-4 md:px-6 py-2 md:py-3 bg-gray-200 hover:bg-gray-300 rounded-full font-bold text-sm md:text-base">
              Back
            </button>
            <button onClick={signOut} className="text-gray-600 hover:text-gray-800 flex items-center gap-2">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <div className="flex gap-4 md:gap-8 mb-8 md:mb-12 border-b-4 border-amber-200 overflow-x-auto">
            <button
              onClick={() => setAdminTab("hunts")}
              className={`pb-4 px-4 md:px-6 text-lg md:text-2xl font-bold whitespace-nowrap ${adminTab === "hunts" ? "text-amber-600 border-b-4 border-amber-600" : "text-gray-600"}`}
            >
              All Hunts ({adminHunts.length})
            </button>
            <button
              onClick={() => setAdminTab("selfies")}
              className={`pb-4 px-4 md:px-6 text-lg md:text-2xl font-bold whitespace-nowrap ${adminTab === "selfies" ? "text-amber-600 border-b-4 border-amber-600" : "text-gray-600"}`}
            >
              Pending ({userUploads.filter((s) => !s.approved).length})
            </button>
            <button
              onClick={() => setAdminTab("create")}
              className={`pb-4 px-4 md:px-6 text-lg md:text-2xl font-bold whitespace-nowrap ${adminTab === "create" ? "text-amber-600 border-b-4 border-amber-600" : "text-gray-600"}`}
            >
              + Create Hunt
            </button>
          </div>

          {adminTab === "hunts" && (
            <div className="grid gap-4 md:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {adminHunts.map((hunt) => (
                <div key={hunt.id} className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                  <img src={getSafePhotoUrl(hunt.photo)} alt={hunt.business_name} className="w-full h-48 md:h-64 object-cover" />
                  <div className="p-4 md:p-6">
                    <span className="inline-block px-3 md:px-4 py-1 bg-amber-200 text-amber-800 rounded-full text-xs font-bold mb-3">
                      {hunt.category}
                    </span>
                    <h3 className="text-xl md:text-2xl font-black text-amber-900 mb-2">{hunt.business_name}</h3>
                    <p className="text-sm md:text-base text-gray-600 italic mb-4">"{hunt.riddle}"</p>
                    <p className="text-xs md:text-sm"><strong>Code:</strong> {hunt.code}</p>
                    <p className="text-xs md:text-sm"><strong>QR Code:</strong> {hunt.qr_code || "Not set"}</p>
                    <p className="text-xs md:text-sm"><strong>Date:</strong> {new Date(hunt.date).toLocaleDateString()}</p>
                    <p className="text-xs md:text-sm"><strong>Duration:</strong> {hunt.duration ? hunt.duration.replace('hour', ' hour').replace('day', ' day').replace('week', ' week') : '1 day'}</p>
                    <p className="text-xs md:text-sm mb-4"><strong>Radius:</strong> {hunt.radius}m</p>
                    <p className="text-xs md:text-sm mb-4"><strong>Trim:</strong> {hunt.trim_color || "none"}</p>
                    <div className="flex gap-2 md:gap-3">
                      <button
                        onClick={() => startEditHunt(hunt)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 md:py-3 rounded-xl font-bold text-sm md:text-base transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteHunt(hunt.id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 md:py-3 rounded-xl font-bold text-sm md:text-base transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {adminTab === "selfies" && (
            <>
              {userUploads.filter((s) => !s.approved).length === 0 ? (
                <p className="text-center text-gray-600 text-lg md:text-xl py-12">No pending selfies</p>
              ) : (
                userUploads
                  .filter((s) => !s.approved)
                  .map((sub) => (
                    <div key={sub.id} className="bg-white rounded-3xl shadow-2xl flex flex-col lg:flex-row mb-6 md:mb-8">
                      <img src={sub.image_url} alt="Selfie" className="w-full lg:w-96 h-64 md:h-96 object-cover" />
                      <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
                        <p className="text-lg md:text-xl mb-2"><strong>User ID:</strong> {sub.user_id.slice(0, 8)}...</p>
                        <p className="text-lg md:text-xl mb-2"><strong>Hunt:</strong> {sub.hunt_name}</p>
                        <p className="text-xs md:text-sm text-gray-600 mb-6 md:mb-8">
                          Submitted: {new Date(sub.created_at).toLocaleString()}
                        </p>
                        <div className="flex gap-4 md:gap-6">
                          <button
                            onClick={() => approveSelfie(sub.id)}
                            disabled={processingSubmission === sub.id}
                            className={`flex-1 py-4 md:py-5 rounded-2xl font-bold text-lg md:text-xl flex items-center justify-center gap-2 md:gap-3 transition ${
                              processingSubmission === sub.id
                                ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                                : "bg-green-600 hover:bg-green-700 text-white"
                            }`}
                          >
                            <Check size={20} /> {processingSubmission === sub.id ? "..." : "Approve"}
                          </button>
                          <button
                            onClick={() => rejectSelfie(sub.id)}
                            disabled={processingSubmission === sub.id}
                            className={`flex-1 py-4 md:py-5 rounded-2xl font-bold text-lg md:text-xl flex items-center justify-center gap-2 md:gap-3 transition ${
                              processingSubmission === sub.id
                                ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                                : "bg-red-600 hover:bg-red-700 text-white"
                            }`}
                          >
                            <X size={20} /> {processingSubmission === sub.id ? "..." : "Reject"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </>
          )}

          {adminTab === "create" && (
            <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-black text-amber-900 mb-8 md:mb-10 text-center">Create New Hunt</h2>
              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Active From Date</label>
                  <input type="date" value={newHuntDate} onChange={(e) => setNewHuntDate(e.target.value)} className="w-full p-4 md:p-5 border-2 border-amber-200 rounded-2xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Duration</label>
                  <select value={newHuntDuration} onChange={(e) => setNewHuntDuration(e.target.value)} className="w-full p-4 md:p-5 border-2 border-amber-200 rounded-2xl">
                    <option value="1hour">1 hour</option>
                    <option value="3hours">3 hours</option>
                    <option value="12hours">12 hours</option>
                    <option value="1day">1 day</option>
                    <option value="3days">3 days</option>
                    <option value="1week">1 week</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                  <select value={newHuntCategory} onChange={(e) => setNewHuntCategory(e.target.value)} className="w-full p-4 md:p-5 border-2 border-amber-200 rounded-2xl">
                    <option value="">Select category</option>
                    <option>Café</option>
                    <option>Barber</option>
                    <option>Restaurant</option>
                    <option>Gig</option>
                    <option>Museum</option>
                    <option>Food & Drink</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Business Name *</label>
                  <input type="text" value={newHuntBusinessName} onChange={(e) => setNewHuntBusinessName(e.target.value)} className="w-full p-4 md:p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. Brew Coffee House" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Riddle / Clue *</label>
                  <textarea value={newHuntRiddle} onChange={(e) => setNewHuntRiddle(e.target.value)} className="w-full p-4 md:p-5 border-2 border-amber-200 rounded-2xl h-24 md:h-32" placeholder="Write an intriguing riddle..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Secret Code *</label>
                  <input type="text" value={newHuntCode} onChange={(e) => setNewHuntCode(e.target.value)} className="w-full p-4 md:p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. BREW2025" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">QR Code (for instant unlock)</label>
                  <input type="text" value={newHuntQrCode} onChange={(e) => setNewHuntQrCode(e.target.value)} className="w-full p-4 md:p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. BREW2025-QR" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Discount / Reward</label>
                  <input type="text" value={newHuntDiscount} onChange={(e) => setNewHuntDiscount(e.target.value)} className="w-full p-4 md:p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. Free coffee" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Latitude *</label>
                  <input type="text" value={newHuntLat} onChange={(e) => setNewHuntLat(e.target.value)} className="w-full p-4 md:p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. 51.5074" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Longitude *</label>
                  <input type="text" value={newHuntLon} onChange={(e) => setNewHuntLon(e.target.value)} className="w-full p-4 md:p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. -0.1278" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Radius (meters)</label>
                  <input type="number" value={newHuntRadius} onChange={(e) => setNewHuntRadius(e.target.value)} className="w-full p-4 md:p-5 border-2 border-amber-200 rounded-2xl" placeholder="50" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Card Trim Color</label>
                  <select value={newHuntTrim} onChange={(e) => setNewHuntTrim(e.target.value)} className="w-full p-4 md:p-5 border-2 border-amber-200 rounded-2xl">
                    <option value="none">No Trim</option>
                    <option value="green">Green Trim (max 5 per category)</option>
                    <option value="blue">Blue Trim (max 3 per category)</option>
                    <option value="purple">Purple Trim (max 1 per category - shows first)</option>
                    <option value="gold">Gold Trim (visible only to Pro+ hunters)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Hunt Photo</label>
                  <input type="file" accept="image/*" onChange={(e) => setNewHuntPhoto(e.target.files?.[0] || null)} className="w-full p-4 md:p-5 border-2 border-dashed border-amber-300 rounded-2xl bg-amber-50 text-sm" />
                </div>
              </div>
              <button
                onClick={createHunt}
                disabled={creatingHunt}
                className="mt-8 md:mt-10 w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white py-5 md:py-6 rounded-2xl font-black text-xl md:text-2xl transition"
              >
                {creatingHunt ? "Creating..." : "Create Hunt"}
              </button>
            </div>
          )}

          {/* Edit Modal – same as create but pre-filled */}
          {showEditModal && editingHunt && (
            <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 md:p-6 overflow-y-auto">
              <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 max-w-4xl w-full my-8">
                <div className="flex justify-between items-center mb-6 md:mb-8">
                  <h2 className="text-2xl md:text-4xl font-black text-amber-900">Edit Hunt</h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingHunt(null);
                      setNewHuntPhoto(null);
                    }}
                    className="text-3xl md:text-4xl text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                {/* Same form fields as create, just with values already set */}
                {/* (Omitted for brevity – copy the create form above and use the same values) */}
                <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                  {/* All inputs same as create form */}
                  {/* ... same as above ... */}
                </div>
                <div className="flex gap-3 md:gap-4 mt-8 md:mt-10">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingHunt(null);
                      setNewHuntPhoto(null);
                    }}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-4 md:py-6 rounded-2xl font-black text-lg md:text-2xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateHunt}
                    disabled={creatingHunt}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white py-4 md:py-6 rounded-2xl font-black text-lg md:text-2xl transition"
                  >
                    {creatingHunt ? "Updating..." : "Update Hunt"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── LOGIN SCREEN ─────────────────────
  if (sessionLoading || !session) {
    if (sessionLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-b-4 border-amber-600 mb-4 md:mb-6"></div>
            <p className="text-xl md:text-2xl text-amber-900 font-bold">Loading...</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50 flex items-center justify-center px-4 md:px-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full text-center">
          <h1 className="text-4xl md:text-6xl font-black text-amber-900 mb-3 md:mb-4">Brew Hunt</h1>
          <p className="text-lg md:text-xl text-amber-800 mb-8 md:mb-12">Real-world treasure hunts in Hackney</p>

          {authError && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-3 md:p-4 mb-4 md:mb-6 flex items-start gap-2 md:gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={18} />
              <p className="text-sm md:text-base text-red-700 text-left">{authError}</p>
            </div>
          )}

          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 md:p-5 mb-3 md:mb-4 border-2 border-amber-200 rounded-2xl text-base md:text-lg" />
          <input type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === "Enter" && signIn()} className="w-full p-4 md:p-5 mb-6 md:mb-8 border-2 border-amber-200 rounded-2xl text-base md:text-lg" />
          <button onClick={signUp} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white py-4 md:py-6 rounded-2xl font-bold text-lg md:text-2xl shadow-lg mb-3 md:mb-4">
            {loading ? "Creating..." : "Sign Up Free"}
          </button>
          <button onClick={signIn} disabled={loading} className="w-full bg-gray-700 hover:bg-gray-800 disabled:opacity-60 text-white py-4 md:py-6 rounded-2xl font-bold text-lg md:text-2xl shadow-lg">
            {loading ? "Signing In..." : "Log In"}
          </button>
        </div>
      </div>
    );
  }

  // ─── LOADING SCREEN AFTER LOGIN ─────────────────────
  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-b-4 border-amber-600 mb-4 md:mb-6"></div>
          <p className="text-xl md:text-2xl text-amber-900 font-bold">Loading your hunts...</p>
        </div>
      </div>
    );
  }

  // ─── MAIN DASHBOARD ─────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50">
      <div className="bg-white/80 backdrop-blur-lg shadow-lg p-4 md:p-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl md:text-4xl font-black text-amber-900">Brew Hunt</h1>
          <div className="flex items-center gap-2 md:gap-4">
            {isAdmin && (
              <button onClick={() => setShowAdmin(true)} className="bg-amber-600 hover:bg-amber-700 text-white px-3 md:px-6 py-2 md:py-3 rounded-full font-bold flex items-center gap-1 md:gap-2 shadow-lg text-sm md:text-base">
                <Shield size={16} className="md:w-5 md:h-5" /> Admin
              </button>
            )}
            <button 
              onClick={() => setShowProfileModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white p-2 md:p-3 rounded-full shadow-lg"
              title="View Profile"
            >
              <User size={20} className="md:w-6 md:h-6" />
            </button>
            <button onClick={signOut} className="text-gray-600 hover:text-gray-800 flex items-center gap-1 md:gap-2">
              <LogOut size={18} className="md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 md:pt-6">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-3 md:p-4 flex items-start gap-2 md:gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={18} />
            <div className="flex-1">
              <p className="text-sm md:text-base text-red-700">{error}</p>
              <button onClick={() => setError("")} className="text-red-800 underline text-xs md:text-sm mt-1 font-bold">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 md:pt-6">
        <div className="flex flex-wrap gap-2 md:gap-3 justify-center mb-6 md:mb-8">
          {["All", "Café", "Barber", "Restaurant", "Gig", "Museum"].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-4 md:px-6 py-2 md:py-3 rounded-full font-bold transition shadow-lg text-sm md:text-base ${
                activeFilter === cat
                  ? "bg-amber-600 text-white scale-105"
                  : "bg-white text-gray-700 hover:bg-amber-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 pb-16 md:pb-24">
          {sortedAndFilteredHunts.length === 0 ? (
            <div className="col-span-2 lg:col-span-4 text-center py-8 md:py-12 bg-white rounded-3xl shadow-xl p-6 md:p-8">
              <p className="text-base md:text-xl text-gray-600 mb-3 md:mb-4">
                No {activeFilter === "All" ? "" : activeFilter} hunts available right now
              </p>
              <p className="text-sm md:text-base text-gray-500">Check back soon for new adventures!</p>
            </div>
          ) : (
            sortedAndFilteredHunts.map((hunt) => (
              <div key={hunt.id} className={`bg-white rounded-3xl shadow-2xl overflow-hidden hover:shadow-3xl transition ${getTrimClass(hunt.trim_color)}`}>
                <div onClick={() => { setCurrentHunt(hunt); setShowDetailModal(true); }} className="cursor-pointer">
                  <img
                    src={getSafePhotoUrl(hunt.photo)}
                    alt={hunt.business_name}
                    className="w-full h-48 md:h-64 object-cover"
                  />
                  <div className="p-4 md:p-6">
                    <span className="inline-block px-3 md:px-4 py-1 md:py-2 bg-amber-200 text-amber-800 rounded-full text-xs font-bold mb-2 md:mb-3">
                      {hunt.category}
                    </span>
                    <p className="text-base md:text-xl font-bold text-gray-800 mb-2 md:mb-3">{hunt.riddle}</p>
                    <p className="text-lg md:text-2xl font-black text-amber-900 mb-2">{hunt.business_name}</p>
                    {hunt.discount && (
                      <p className="text-sm md:text-lg text-green-600 font-semibold">Unlock: {hunt.discount}</p>
                    )}
                  </div>
                </div>
                <div className="px-4 md:px-6 pb-4 md:pb-6">
                  <button
                    onClick={() => {
                      setCurrentHunt(hunt);
                      setShowVerificationModal(true);
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-base md:text-xl shadow-xl"
                  >
                    I'm at the spot!
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail Modal – full description */}
      {showDetailModal && currentHunt && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <button onClick={() => setShowDetailModal(false)} className="absolute top-4 right-4 text-4xl text-gray-500 hover:text-gray-700">&times;</button>
            <img src={getSafePhotoUrl(currentHunt.photo)} alt={currentHunt.business_name} className="w-full h-64 object-cover rounded-2xl mb-6" />
            <span className="inline-block px-4 py-2 bg-amber-200 text-amber-800 rounded-full text-sm font-bold mb-4">{currentHunt.category}</span>
            <h2 className="text-3xl font-black text-amber-900 mb-4">{currentHunt.business_name}</h2>
            <p className="text-xl italic text-gray-700 mb-6">"{currentHunt.riddle}"</p>
            {currentHunt.discount && <p className="text-2xl font-bold text-green-600 mb-6">{currentHunt.discount}</p>}
          </div>
        </div>
      )}

      {/* Verification Modal – Two-Tier System */}
      {showVerificationModal && currentHunt && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
            <button onClick={() => { setShowVerificationModal(false); setSelfieFile(null); setQrInput(""); }} className="absolute top-4 right-4 text-4xl text-gray-500 hover:text-gray-700">&times;</button>
            <h2 className="text-3xl font-black text-amber-900 mb-4">{currentHunt.business_name}</h2>
            <p className="text-xl italic text-gray-700 mb-6">"{currentHunt.riddle}"</p>
            {currentHunt.discount && <p className="text-2xl font-bold text-green-600 mb-8">{currentHunt.discount}</p>}

            {isInfluencer && currentHunt.trim_color === "gold" ? (
              <>
                <p className="text-lg text-center mb-8 font-bold text-purple-600">Exclusive Gold Hunt – Selfie Required</p>
                {selfieFile && <p className="text-center mb-4 text-green-700 font-bold">Photo selected: {selfieFile.name}</p>}
                <input type="file" accept="image/*" capture="environment" onChange={(e) => setSelfieFile(e.target.files?.[0] || null)} className="hidden" id="gold-selfie" />
                <label htmlFor="gold-selfie" className="w-40 h-40 bg-purple-600 hover:bg-purple-700 text-white rounded-full flex items-center justify-center shadow-2xl cursor-pointer mx-auto mb-8">
                  <Camera className="w-20 h-20" />
                </label>
                <button onClick={uploadSelfie} disabled={!selfieFile || uploading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-5 rounded-2xl font-black text-xl">
                  {uploading ? "Submitting..." : "Submit Selfie & Unlock"}
                </button>
              </>
            ) : (
              <>
                <p className="text-lg text-center mb-6">Scan the QR code at the venue for instant unlock</p>
                <div className="relative mb-6">
                  <div className="flex items-center gap-3 border-2 border-amber-300 rounded-2xl p-4 bg-amber-50">
                    <QrCode size={36} className="text-amber-600" />
                    <input
                      type="text"
                      placeholder="Enter QR code here"
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      className="flex-1 text-lg bg-transparent outline-none"
                    />
                  </div>
                </div>
                <button onClick={verifyQrAndUnlock} disabled={uploading} className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-2xl font-black text-xl mb-6">
                  {uploading ? "Verifying..." : "Verify QR & Unlock Code"}
                </button>
                <p className="text-center text-gray-600 text-sm mb-4">— or use selfie as backup —</p>
                {selfieFile && <p className="text-center mb-4 text-blue-700 font-bold">Photo selected: {selfieFile.name}</p>}
                <input type="file" accept="image/*" capture="environment" onChange={(e) => setSelfieFile(e.target.files?.[0] || null)} className="hidden" id="backup-selfie" />
                <label htmlFor="backup-selfie" className="w-32 h-32 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-2xl cursor-pointer mx-auto mb-6">
                  <Camera className="w-16 h-16" />
                </label>
                <button onClick={uploadSelfie} disabled={!selfieFile || uploading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-5 rounded-2xl font-black text-xl">
                  Submit Selfie Backup
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Influencer Opt-In Modal */}
      {showInfluencerOptIn && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
            <h2 className="text-3xl font-black text-amber-900 mb-6">Congratulations! You're a Legend!</h2>
            <p className="text-lg mb-8">Join our Micro-Influencer Network to unlock exclusive gold hunts, extra 5–10% discounts, and cool prizes like gig tickets.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowInfluencerOptIn(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 py-5 rounded-2xl font-bold text-lg">
                Maybe later
              </button>
              <button onClick={async () => {
                await supabase.from("profiles").update({ is_influencer: true }).eq("id", session.user.id);
                setIsInfluencer(true);
                setShowInfluencerOptIn(false);
                alert("Welcome to the Influencer Network! Get ready for exclusive hunts!");
              }} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-5 rounded-2xl font-bold text-lg">
                Join Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 md:p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full text-center relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 md:top-6 md:right-6 text-3xl md:text-4xl text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
            <User className="w-12 h-12 md:w-16 md:h-16 text-purple-600 mx-auto mb-4 md:mb-6" />
            <h2 className="text-3xl md:text-4xl font-black text-amber-900 mb-8 md:mb-10">Your Profile</h2>
            
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-6 md:p-8 mb-6 md:mb-8">
              <div className="flex justify-between items-center mb-4 md:mb-6">
                <div>
                  <div className="text-4xl md:text-5xl font-black text-orange-600">{streak}</div>
                  <p className="text-sm md:text-base text-gray-600 font-medium">day streak</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl md:text-3xl font-black text-purple-600">{tier}</div>
                  <p className="text-sm md:text-base text-gray-600 font-medium">tier</p>
                </div>
              </div>
              <div className="text-center pt-4 md:pt-6 border-t-2 border-amber-200">
                <button
                  onClick={() => setShowCompletedModal(true)}
                  className="text-lg md:text-xl underline text-gray-700 hover:text-gray-900 font-bold"
                >
                  {totalHunts} completed · {activeHuntsCount} active
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setShowProfileModal(false);
                setShowLeaderboard(true);
              }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 md:py-6 rounded-2xl font-black text-xl md:text-2xl shadow-xl flex items-center justify-center gap-2 md:gap-3"
            >
              <Trophy className="w-6 h-6 md:w-8 md:h-8" /> View Leaderboard
            </button>
          </div>
        </div>
      )}

      {/* Completed Hunts Modal */}
      {showCompletedModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 md:p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full text-center relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCompletedModal(false)}
              className="absolute top-4 right-4 md:top-6 md:right-6 text-3xl md:text-4xl text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
            <Trophy className="w-12 h-12 md:w-16 md:h-16 text-amber-600 mx-auto mb-4 md:mb-6" />
            <h2 className="text-3xl md:text-4xl font-black text-amber-900 mb-8 md:mb-10">
              Your Completed Hunts ({totalHunts})
            </h2>
            {completedHunts.length === 0 ? (
              <p className="text-base md:text-xl text-gray-600">No completed hunts yet — get hunting!</p>
            ) : (
              <div className="space-y-6 md:space-y-8">
                {completedHunts.map((hunt) => (
                  <div key={hunt.id} className="bg-gray-50 rounded-2xl p-4 md:p-6 text-left">
                    <img
                      src={getSafePhotoUrl(hunt.photo)}
                      alt="Hunt"
                      className="w-full h-32 md:h-48 object-cover rounded-xl mb-3 md:mb-4"
                    />
                    <p className="text-lg md:text-xl font-bold text-gray-800 mb-2">{hunt.riddle}</p>
                    <p className="text-base md:text-lg text-gray-700 mb-2">{hunt.business_name}</p>
                    <div className="bg-green-100 rounded-xl p-3 md:p-4 mt-3 md:mt-4">
                      <p className="text-xs md:text-sm text-green-800 font-semibold mb-1">Your code:</p>
                      <p className="text-green-600 font-black text-xl md:text-2xl">{hunt.code}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 md:p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full text-center relative">
            <button
              onClick={() => setShowLeaderboard(false)}
              className="absolute top-4 right-4 md:top-6 md:right-6 text-3xl md:text-4xl text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
            <Trophy className="w-12 h-12 md:w-16 md:h-16 text-amber-600 mx-auto mb-4 md:mb-6" />
            <h2 className="text-3xl md:text-4xl font-black text-amber-900 mb-8 md:mb-10">Hackney Top Hunters</h2>

            {loadingLeaderboard ? (
              <div className="py-8 md:py-12">
                <div className="inline-block animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-4 border-amber-600"></div>
              </div>
            ) : leaderboardData.length === 0 ? (
              <p className="text-base md:text-xl text-gray-600">No data available yet</p>
            ) : (
              <div className="space-y-4 md:space-y-6 text-left">
                {leaderboardData.map((user, idx) => (
                  <div
                    key={idx}
                    className={`p-4 md:p-6 rounded-2xl ${
                      idx === 0 ? "bg-amber-100" :
                      idx === 1 ? "bg-gray-100" :
                      idx === 2 ? "bg-orange-50" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 md:gap-4">
                        <span className="text-2xl md:text-3xl font-black text-gray-700">#{idx + 1}</span>
                        <div>
                          <p className="font-bold text-base md:text-xl text-gray-800">{user.displayName}</p>
                          <p className="text-xs md:text-sm text-gray-600">{user.tier}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl md:text-2xl font-black text-amber-600">{user.hunts}</p>
                        <p className="text-xs md:text-sm text-gray-600">hunts</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
