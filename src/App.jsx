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
} from "lucide-react";

const supabaseUrl = "https://eeboxlitezqgjyrnssgx.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlYm94bGl0ZXpxZ2p5cm5zc2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjcyNTksImV4cCI6MjA4MDI0MzI1OX0.8VlGLHjEv_0aGWOjiDuLLziOCnUqciIAEWayMUGsXT8";

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const ADMIN_EMAIL = "quinten.geurs@gmail.com";

const getSafePhotoUrl = (url: string | null): string => {
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

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayLocalDate(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const [hunts, setHunts] = useState<any[]>([]);
  const [filteredHunts, setFilteredHunts] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [completed, setCompleted] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalHunts, setTotalHunts] = useState(0);
  const [tier, setTier] = useState("Newbie");
  const [lastActive, setLastActive] = useState<string | null>(null);
  const [currentHunt, setCurrentHunt] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState("");
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState("hunts");
  const [adminHunts, setAdminHunts] = useState<any[]>([]);
  const [selfies, setSelfies] = useState<any[]>([]);
  const [processingSubmission, setProcessingSubmission] = useState<string | null>(null);
  const [editingHunt, setEditingHunt] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Create Hunt Form
  const [newHuntDate, setNewHuntDate] = useState("");
  const [newHuntCategory, setNewHuntCategory] = useState("");
  const [newHuntRiddle, setNewHuntRiddle] = useState("");
  const [newHuntBusinessName, setNewHuntBusinessName] = useState("");
  const [newHuntCode, setNewHuntCode] = useState("");
  const [newHuntDiscount, setNewHuntDiscount] = useState("");
  const [newHuntLat, setNewHuntLat] = useState("");
  const [newHuntLon, setNewHuntLon] = useState("");
  const [newHuntRadius, setNewHuntRadius] = useState("50");
  const [newHuntPhoto, setNewHuntPhoto] = useState<File | null>(null);
  const [creatingHunt, setCreatingHunt] = useState(false);

  // ─── AUTH & PROFILE AUTO-CREATE ─────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setIsAdmin(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        setShowAdmin(false);
      }

      if (session) {
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
          });
        }
      }
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  // ─── REALTIME SUBSCRIPTIONS ─────────────────────
  useEffect(() => {
    if (!session || showAdmin) return;

    const huntsChannel = supabase
      .channel("hunts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "hunts" }, () => fetchHunts())
      .subscribe();

    const progressChannel = supabase
      .channel("progress-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_progress",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => loadProgressAndHunts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(huntsChannel);
      supabase.removeChannel(progressChannel);
    };
  }, [session, showAdmin]);

  // ─── LOAD DATA ─────────────────────
  useEffect(() => {
    if (!session) return;
    if (showAdmin) {
      loadAdminData();
    } else {
      setDataLoaded(false);
      loadProgressAndHunts();
    }
  }, [session, showAdmin]);

  const loadProgressAndHunts = useCallback(async () => {
    if (!session) return; // FIX 1: Guard against missing session
    
    try {
      setError("");

      const { data: progressRows, error: progressError } = await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", session.user.id)
        .order("last_active", { ascending: false });

      if (progressError) throw progressError;

      let completedIds: string[] = [];
      const progress = progressRows?.[0] || null;

      if (progress) {
        completedIds = Array.isArray(progress.completed_hunt_ids) ? progress.completed_hunt_ids : [];

        if (progressRows.length > 1) {
          const all = new Set<string>();
          let maxTotal = 0, maxStreak = 0;
          progressRows.forEach((r: any) => {
            if (Array.isArray(r.completed_hunt_ids)) r.completed_hunt_ids.forEach((id: string) => all.add(id));
            maxTotal = Math.max(maxTotal, r.total_hunts || 0);
            maxStreak = Math.max(maxStreak, r.streak || 0);
          });
          completedIds = Array.from(all);
          setTotalHunts(completedIds.length);
          setStreak(maxStreak);
          for (let i = 1; i < progressRows.length; i++) {
            await supabase.from("user_progress").delete().eq("id", progressRows[i].id);
          }
        } else {
          setTotalHunts(progress.total_hunts || 0);
          setStreak(progress.streak || 0);
        }
        setCompleted(completedIds);
        setTier(
          completedIds.length >= 20 ? "Legend" : completedIds.length >= 10 ? "Pro" : completedIds.length >= 5 ? "Hunter" : "Newbie"
        );
        setLastActive(progress.last_active || null);
      } else {
        setCompleted([]);
        setStreak(0);
        setTotalHunts(0);
        setTier("Newbie");
        setLastActive(null);
      }

      const todayISO = new Date().toISOString().split("T")[0];
      const { data: huntsData, error: huntsError } = await supabase
        .from("hunts")
        .select("*")
        .gte("date", todayISO)
        .order("date", { ascending: false });

      if (huntsError) throw huntsError;

      setHunts(huntsData || []);
      applyFilter(huntsData || [], completedIds, activeFilter);
      setDataLoaded(true);
    } catch (e: any) {
      console.error("Load error:", e);
      setError("Failed to load hunts. Please refresh.");
      setDataLoaded(true);
    }
  }, [session, activeFilter, applyFilter]); // FIX 2: Add applyFilter to dependencies

  const fetchHunts = useCallback(async () => {
    const todayISO = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("hunts")
      .select("*")
      .gte("date", todayISO)
      .order("date", { ascending: false });
    if (data) setHunts(data);
  }, []);

  const applyFilter = useCallback(
    (allHunts: any[], completedIds: string[], filterCategory: string) => {
      let filtered = allHunts.filter((h) => !completedIds.includes(h.id));
      if (filterCategory !== "All") filtered = filtered.filter((h) => h.category === filterCategory);
      setFilteredHunts(filtered);
    },
    []
  );

  useEffect(() => {
    if (dataLoaded && hunts.length > 0) applyFilter(hunts, completed, activeFilter);
  }, [hunts, completed, activeFilter, dataLoaded, applyFilter]);

  // ─── SELFIE UPLOAD ─────────────────────
  const uploadSelfie = useCallback(async () => {
    if (!selfieFile || !currentHunt || uploading || !session) return; // FIX 3: Add session guard
    if (completed.includes(currentHunt.id)) {
      alert("You have already completed this hunt!");
      setShowModal(false);
      setSelfieFile(null);
      return;
    }

    setUploading(true);
    setError("");

    try {
      if (!navigator.geolocation) throw new Error("Geolocation not supported");

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
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

      const fileExt = selfieFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${session.user.id}_${currentHunt.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("selfies")
        .upload(fileName, selfieFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("selfies")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("selfies").insert({
        user_id: session.user.id,
        hunt_id: currentHunt.id,
        image_url: publicUrl,
      });

      if (insertError) {
        await supabase.storage.from("selfies").remove([fileName]);
        throw insertError;
      }

      const newCompleted = [...new Set([...completed, currentHunt.id])];
      const today = getTodayLocalDate();
      let newStreak = streak;
      if (lastActive === getYesterdayLocalDate()) newStreak = streak + 1;
      else if (lastActive !== today) newStreak = 1;

      const newTier = newCompleted.length >= 20 ? "Legend" : newCompleted.length >= 10 ? "Pro" : newCompleted.length >= 5 ? "Hunter" : "Newbie";

      await supabase.from("user_progress").upsert(
        {
          user_id: session.user.id,
          completed_hunt_ids: newCompleted,
          total_hunts: newCompleted.length,
          streak: newStreak,
          tier: newTier,
          last_active: today,
        },
        { onConflict: "user_id" }
      );

      setCompleted(newCompleted);
      setTotalHunts(newCompleted.length);
      setStreak(newStreak);
      setTier(newTier);
      setLastActive(today);

      setShowModal(false);
      setSelfieFile(null);
      setCurrentHunt(null);
      alert(`Success! Your code is: ${currentHunt.code}`);
    } catch (err: any) {
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

      const userIds = data.map((item: any) => item.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", userIds);

      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

      const enriched = data.map((item: any, idx: number) => {
        const profile = profileMap[item.user_id];
        const displayName = profile?.username || profile?.full_name || `Hunter #${idx + 1}`;
        return { displayName, hunts: item.total_hunts, tier: item.tier || "Newbie" };
      });

      setLeaderboardData(enriched);
    } catch (err) {
      console.error("Leaderboard error:", err);
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

      const { data: subs } = await supabase.from("selfies").select("*").order("created_at", { ascending: false });

      const enriched = await Promise.all(
        (subs || []).map(async (sub: any) => {
          const { data: hunt } = await supabase
            .from("hunts")
            .select("business_name")
            .eq("id", sub.hunt_id)
            .single();
          return { ...sub, hunt_name: hunt?.business_name || "Unknown", user_email: sub.user_id };
        })
      );
      setSelfies(enriched);
    } catch (e) {
      setError("Failed to load admin data");
    }
  }, []);

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

    setCreatingHunt(true);
    try {
      let photoUrl: string | null = null;

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

      const { error } = await supabase.from("hunts").insert({
        date: newHuntDate || getTodayLocalDate(),
        category: newHuntCategory || "Food & Drink",
        riddle: newHuntRiddle.trim(),
        business_name: newHuntBusinessName.trim(),
        code: newHuntCode.trim(),
        discount: newHuntDiscount.trim(),
        photo: photoUrl,
        lat,
        lon,
        radius: parseInt(newHuntRadius) || 50,
      });

      if (error) throw error;

      alert("Hunt created successfully!");
      setNewHuntDate("");
      setNewHuntCategory("");
      setNewHuntRiddle("");
      setNewHuntBusinessName("");
      setNewHuntCode("");
      setNewHuntDiscount("");
      setNewHuntLat("");
      setNewHuntLon("");
      setNewHuntRadius("50");
      setNewHuntPhoto(null);
      loadAdminData();
      setAdminTab("hunts");
    } catch (err: any) {
      alert("Failed to create hunt: " + (err.message || "Unknown error"));
    } finally {
      setCreatingHunt(false);
    }
  }, [
    newHuntDate, newHuntCategory, newHuntRiddle, newHuntBusinessName,
    newHuntCode, newHuntDiscount, newHuntLat, newHuntLon, newHuntRadius,
    newHuntPhoto, loadAdminData
  ]);

  // ─── ADMIN APPROVE / REJECT ─────────────────────
  const approveSelfie = useCallback(async (id: string) => {
    setProcessingSubmission(id);
    try {
      const { error } = await supabase.from("selfies").update({ approved: true }).eq("id", id);
      if (error) throw error;
      await loadAdminData();
    } catch {
      alert("Failed to approve");
    } finally {
      setProcessingSubmission(null);
    }
  }, [loadAdminData]);

  const rejectSelfie = useCallback(async (id: string) => {
    if (!window.confirm("Reject this submission?")) return;
    setProcessingSubmission(id);
    try {
      const { error } = await supabase.from("selfies").delete().eq("id", id);
      if (error) throw error;
      await loadAdminData();
    } catch {
      alert("Failed to reject");
    } finally {
      setProcessingSubmission(null);
    }
  }, [loadAdminData]);

  // ─── EDIT HUNT ─────────────────────
  const startEditHunt = useCallback((hunt: any) => {
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

      const { error } = await supabase.from("hunts").update({
        date: newHuntDate || getTodayLocalDate(),
        category: newHuntCategory || "Food & Drink",
        riddle: newHuntRiddle.trim(),
        business_name: newHuntBusinessName.trim(),
        code: newHuntCode.trim(),
        discount: newHuntDiscount.trim(),
        photo: photoUrl,
        lat,
        lon,
        radius: parseInt(newHuntRadius) || 50,
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
      setNewHuntPhoto(null);
      loadAdminData();
    } catch (err: any) {
      alert("Failed to update hunt: " + (err.message || "Unknown error"));
    } finally {
      setCreatingHunt(false);
    }
  }, [
    editingHunt, newHuntDate, newHuntCategory, newHuntRiddle, newHuntBusinessName,
    newHuntCode, newHuntDiscount, newHuntLat, newHuntLon, newHuntRadius,
    newHuntPhoto, loadAdminData
  ]);

  const deleteHunt = useCallback(async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this hunt? This cannot be undone.")) return;
    
    try {
      const { error } = await supabase.from("hunts").delete().eq("id", id);
      if (error) throw error;
      alert("Hunt deleted successfully!");
      loadAdminData();
    } catch (err: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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

  // ─── ADMIN PANEL ─────────────────────
  if (showAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white shadow-xl p-6 sticky top-0 z-50 flex justify-between items-center">
          <h1 className="text-4xl font-black text-amber-900 flex items-center gap-4">
            <Shield className="w-12 h-12" />
            Admin Panel
          </h1>
          <div className="flex gap-4">
            <button onClick={() => setShowAdmin(false)} className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-full font-bold">
              Back to App
            </button>
            <button onClick={signOut} className="text-gray-600 hover:text-gray-800 flex items-center gap-2">
              <LogOut size={20} /> Log Out
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-8">
          <div className="flex gap-8 mb-12 border-b-4 border-amber-200">
            <button
              onClick={() => setAdminTab("hunts")}
              className={`pb-4 px-6 text-2xl font-bold ${adminTab === "hunts" ? "text-amber-600 border-b-4 border-amber-600" : "text-gray-600"}`}
            >
              All Hunts ({adminHunts.length})
            </button>
            <button
              onClick={() => setAdminTab("selfies")}
              className={`pb-4 px-6 text-2xl font-bold ${adminTab === "selfies" ? "text-amber-600 border-b-4 border-amber-600" : "text-gray-600"}`}
            >
              Pending ({selfies.filter((s) => !s.approved).length})
            </button>
            <button
              onClick={() => setAdminTab("create")}
              className={`pb-4 px-6 text-2xl font-bold ${adminTab === "create" ? "text-amber-600 border-b-4 border-amber-600" : "text-gray-600"}`}
            >
              + Create Hunt
            </button>
          </div>

          {/* ALL HUNTS */}
          {adminTab === "hunts" && (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {adminHunts.map((hunt) => (
                <div key={hunt.id} className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                  <img src={getSafePhotoUrl(hunt.photo)} alt={hunt.business_name} className="w-full h-64 object-cover" />
                  <div className="p-6">
                    <span className="inline-block px-4 py-1 bg-amber-200 text-amber-800 rounded-full text-xs font-bold mb-3">
                      {hunt.category}
                    </span>
                    <h3 className="text-2xl font-black text-amber-900 mb-2">{hunt.business_name}</h3>
                    <p className="text-gray-600 italic mb-4">"{hunt.riddle}"</p>
                    <p className="text-sm"><strong>Code:</strong> {hunt.code}</p>
                    <p className="text-sm"><strong>Date:</strong> {new Date(hunt.date).toLocaleDateString()}</p>
                    <p className="text-sm mb-4"><strong>Radius:</strong> {hunt.radius}m</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => startEditHunt(hunt)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteHunt(hunt.id)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SELFIES */}
          {adminTab === "selfies" && (
            <>
              {selfies.filter((s) => !s.approved).length === 0 ? (
                <p className="text-center text-gray-600 text-xl py-12">No pending selfies</p>
              ) : (
                selfies
                  .filter((s) => !s.approved)
                  .map((sub) => (
                    <div key={sub.id} className="bg-white rounded-3xl shadow-2xl flex flex-col lg:flex-row mb-8">
                      <img src={sub.image_url} alt="Selfie" className="w-full lg:w-96 h-96 object-cover" />
                      <div className="p-8 flex-1 flex flex-col justify-center">
                        <p className="text-xl mb-2"><strong>User ID:</strong> {sub.user_id.slice(0, 8)}...</p>
                        <p className="text-xl mb-2"><strong>Hunt:</strong> {sub.hunt_name}</p>
                        <p className="text-sm text-gray-600 mb-8">
                          Submitted: {new Date(sub.created_at).toLocaleString()}
                        </p>
                        <div className="flex gap-6">
                          <button
                            onClick={() => approveSelfie(sub.id)}
                            disabled={processingSubmission === sub.id}
                            className={`flex-1 py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition ${
                              processingSubmission === sub.id
                                ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                                : "bg-green-600 hover:bg-green-700 text-white"
                            }`}
                          >
                            <Check size={24} /> {processingSubmission === sub.id ? "Processing..." : "Approve"}
                          </button>
                          <button
                            onClick={() => rejectSelfie(sub.id)}
                            disabled={processingSubmission === sub.id}
                            className={`flex-1 py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition ${
                              processingSubmission === sub.id
                                ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                                : "bg-red-600 hover:bg-red-700 text-white"
                            }`}
                          >
                            <X size={24} /> {processingSubmission === sub.id ? "Processing..." : "Reject"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </>
          )}

          {/* CREATE HUNT */}
          {adminTab === "create" && (
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-4xl mx-auto">
              <h2 className="text-4xl font-black text-amber-900 mb-10 text-center">Create New Hunt</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Active From Date</label>
                  <input type="date" value={newHuntDate} onChange={(e) => setNewHuntDate(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                  <select value={newHuntCategory} onChange={(e) => setNewHuntCategory(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl">
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
                  <input type="text" value={newHuntBusinessName} onChange={(e) => setNewHuntBusinessName(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. Brew Coffee House" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Riddle / Clue *</label>
                  <textarea value={newHuntRiddle} onChange={(e) => setNewHuntRiddle(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl h-32" placeholder="Write an intriguing riddle..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Secret Code *</label>
                  <input type="text" value={newHuntCode} onChange={(e) => setNewHuntCode(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. BREW2025" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Discount / Reward</label>
                  <input type="text" value={newHuntDiscount} onChange={(e) => setNewHuntDiscount(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. Free coffee" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Latitude *</label>
                  <input type="text" value={newHuntLat} onChange={(e) => setNewHuntLat(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. 51.5074" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Longitude *</label>
                  <input type="text" value={newHuntLon} onChange={(e) => setNewHuntLon(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. -0.1278" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Radius (meters)</label>
                  <input type="number" value={newHuntRadius} onChange={(e) => setNewHuntRadius(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" placeholder="50" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Hunt Photo</label>
                  <input type="file" accept="image/*" onChange={(e) => setNewHuntPhoto(e.target.files?.[0] || null)} className="w-full p-5 border-2 border-dashed border-amber-300 rounded-2xl bg-amber-50" />
                </div>
              </div>
              <button
                onClick={createHunt}
                disabled={creatingHunt}
                className="mt-10 w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white py-6 rounded-2xl font-black text-2xl transition"
              >
                {creatingHunt ? "Creating..." : "Create Hunt"}
              </button>
            </div>
          )}
        </div>

        {/* EDIT HUNT MODAL */}
        {showEditModal && editingHunt && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-4xl w-full my-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-4xl font-black text-amber-900">Edit Hunt</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingHunt(null);
                    setNewHuntPhoto(null);
                  }}
                  className="text-4xl text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Active From Date</label>
                  <input type="date" value={newHuntDate} onChange={(e) => setNewHuntDate(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                  <select value={newHuntCategory} onChange={(e) => setNewHuntCategory(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl">
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
                  <input type="text" value={newHuntBusinessName} onChange={(e) => setNewHuntBusinessName(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. Brew Coffee House" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Riddle / Clue *</label>
                  <textarea value={newHuntRiddle} onChange={(e) => setNewHuntRiddle(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl h-32" placeholder="Write an intriguing riddle..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Secret Code *</label>
                  <input type="text" value={newHuntCode} onChange={(e) => setNewHuntCode(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. BREW2025" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Discount / Reward</label>
                  <input type="text" value={newHuntDiscount} onChange={(e) => setNewHuntDiscount(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. Free coffee" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Latitude *</label>
                  <input type="text" value={newHuntLat} onChange={(e) => setNewHuntLat(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. 51.5074" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Longitude *</label>
                  <input type="text" value={newHuntLon} onChange={(e) => setNewHuntLon(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" placeholder="e.g. -0.1278" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Radius (meters)</label>
                  <input type="number" value={newHuntRadius} onChange={(e) => setNewHuntRadius(e.target.value)} className="w-full p-5 border-2 border-amber-200 rounded-2xl" placeholder="50" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Hunt Photo (leave empty to keep current)</label>
                  {editingHunt.photo && !newHuntPhoto && (
                    <div className="mb-4">
                      <img src={getSafePhotoUrl(editingHunt.photo)} alt="Current" className="w-full h-48 object-cover rounded-xl" />
                      <p className="text-sm text-gray-600 mt-2">Current photo (will be kept if you don't upload a new one)</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={(e) => setNewHuntPhoto(e.target.files?.[0] || null)} className="w-full p-5 border-2 border-dashed border-amber-300 rounded-2xl bg-amber-50" />
                </div>
              </div>
              <div className="flex gap-4 mt-10">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingHunt(null);
                    setNewHuntPhoto(null);
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-6 rounded-2xl font-black text-2xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={updateHunt}
                  disabled={creatingHunt}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white py-6 rounded-2xl font-black text-2xl transition"
                >
                  {creatingHunt ? "Updating..." : "Update Hunt"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── LOGIN SCREEN ─────────────────────
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
          <h1 className="text-6xl font-black text-amber-900 mb-4">Brew Hunt</h1>
          <p className="text-xl text-amber-800 mb-12">Real-world treasure hunts in Hackney</p>

          {authError && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
              <p className="text-red-700 text-left">{authError}</p>
            </div>
          )}

          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-5 mb-4 border-2 border-amber-200 rounded-2xl text-lg" />
          <input type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === "Enter" && signIn()} className="w-full p-5 mb-8 border-2 border-amber-200 rounded-2xl text-lg" />
          <button onClick={signUp} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white py-6 rounded-2xl font-bold text-2xl shadow-lg mb-4">
            {loading ? "Creating..." : "Sign Up Free"}
          </button>
          <button onClick={signIn} disabled={loading} className="w-full bg-gray-700 hover:bg-gray-800 disabled:opacity-60 text-white py-6 rounded-2xl font-bold text-2xl shadow-lg">
            {loading ? "Signing In..." : "Log In"}
          </button>
        </div>
      </div>
    );
  }

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-amber-600 mb-6"></div>
          <p className="text-2xl text-amber-900 font-bold">Loading your hunts...</p>
        </div>
      </div>
    );
  }

  const activeHuntsCount = hunts.filter((h) => !completed.includes(h.id)).length;
  const completedHunts = hunts.filter((h) => completed.includes(h.id));

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50">
      {/* HEADER */}
      <div className="bg-white/80 backdrop-blur-lg shadow-lg p-6 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <h1 className="text-4xl font-black text-amber-900">Brew Hunt</h1>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <button onClick={() => setShowAdmin(true)} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg">
                <Shield size={20} /> Admin
              </button>
            )}
            <button onClick={signOut} className="text-gray-600 hover:text-gray-800 flex items-center gap-2">
              <LogOut size={20} /> Log Out
            </button>
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="max-w-md mx-auto px-6 pt-6">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
            <div className="flex-1">
              <p className="text-red-700">{error}</p>
              <button onClick={() => setError("")} className="text-red-800 underline text-sm mt-1 font-bold">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="max-w-md mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-6xl font-black text-orange-600">{streak}</div>
              <p className="text-gray-600 font-medium">day streak</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-purple-600">{tier}</div>
              <button
                onClick={() => setShowCompletedModal(true)}
                className="text-xl underline text-gray-700 hover:text-gray-900"
              >
                {totalHunts} completed · {activeHuntsCount} active
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="max-w-md mx-auto px-6">
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          {["All", "Café", "Barber", "Restaurant", "Gig", "Museum"].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-6 py-3 rounded-full font-bold transition shadow-lg ${
                activeFilter === cat
                  ? "bg-amber-600 text-white scale-105"
                  : "bg-white text-gray-700 hover:bg-amber-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="text-center mb-8">
          <button
            onClick={() => setShowLeaderboard(true)}
            className="text-amber-700 underline font-bold text-xl flex items-center gap-2 mx-auto hover:text-amber-900"
          >
            <Trophy className="w-6 h-6" /> Leaderboard
          </button>
        </div>

        {/* HUNTS LIST */}
        <div className="space-y-8 pb-24">
          {filteredHunts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl shadow-xl p-8">
              <p className="text-gray-600 text-xl mb-4">
                No {activeFilter === "All" ? "" : activeFilter} hunts available right now
              </p>
              <p className="text-gray-500">Check back soon for new adventures!</p>
            </div>
          ) : (
            filteredHunts.map((hunt) => (
              <div key={hunt.id} className="bg-white rounded-3xl shadow-2xl overflow-hidden hover:shadow-3xl transition">
                <div className="relative">
                  <img
                    src={getSafePhotoUrl(hunt.photo)}
                    alt={hunt.business_name}
                    className="w-full h-72 object-cover"
                  />
                </div>
                <div className="p-8">
                  <span className="inline-block px-5 py-2 bg-amber-200 text-amber-800 rounded-full text-sm font-bold mb-4">
                    {hunt.category}
                  </span>
                  <p className="text-2xl font-bold mb-4 text-gray-800">{hunt.riddle}</p>
                  <p className="text-xl font-medium text-gray-700 mb-2">{hunt.business_name}</p>
                  {hunt.discount && (
                    <p className="text-lg text-green-600 font-semibold mb-8">Gift: {hunt.discount}</p>
                  )}
                  <button
                    onClick={() => {
                      setCurrentHunt(hunt);
                      setShowModal(true);
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-2xl font-black text-2xl shadow-xl"
                  >
                    I'm at the spot!
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* COMPLETED HUNTS MODAL */}
      {showCompletedModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCompletedModal(false)}
              className="absolute top-6 right-6 text-4xl text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
            <Trophy className="w-16 h-16 text-amber-600 mx-auto mb-6" />
            <h2 className="text-4xl font-black text-amber-900 mb-10">
              Your Completed Hunts ({totalHunts})
            </h2>
            {completedHunts.length === 0 ? (
              <p className="text-gray-600 text-xl">No completed hunts yet — get hunting!</p>
            ) : (
              <div className="space-y-8">
                {completedHunts.map((hunt) => (
                  <div key={hunt.id} className="bg-gray-50 rounded-2xl p-6 text-left">
                    <img
                      src={getSafePhotoUrl(hunt.photo)}
                      alt="Hunt"
                      className="w-full h-48 object-cover rounded-xl mb-4"
                    />
                    <p className="text-xl font-bold text-gray-800 mb-2">{hunt.riddle}</p>
                    <p className="text-lg text-gray-700 mb-2">{hunt.business_name}</p>
                    <div className="bg-green-100 rounded-xl p-4 mt-4">
                      <p className="text-sm text-green-800 font-semibold mb-1">Your code:</p>
                      <p className="text-green-600 font-black text-2xl">{hunt.code}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SELFIE MODAL */}
      {showModal && currentHunt && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center relative">
            <button
              onClick={() => {
                setShowModal(false);
                setSelfieFile(null);
                setCurrentHunt(null);
              }}
              className="absolute top-6 right-6 text-4xl text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
            <h3 className="text-4xl font-black text-gray-800 mb-4">Show the logo!</h3>
            <p className="text-xl text-gray-600 mb-2">Take a selfie with the business logo</p>
            <p className="text-lg text-amber-600 font-bold mb-10">Win £50 weekly for best selfie!</p>

            {selfieFile && (
              <div className="mb-6 p-4 bg-green-50 rounded-2xl">
                <p className="text-green-700 font-semibold">Photo ready!</p>
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
              className="hidden"
              id="camera"
            />
            <label
              htmlFor="camera"
              className="w-44 h-44 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center shadow-2xl cursor-pointer mx-auto mb-12"
            >
              <Camera className="w-20 h-20" />
            </label>

            <button
              onClick={uploadSelfie}
              disabled={!selfieFile || uploading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 rounded-2xl font-black text-2xl transition"
            >
              {uploading ? "Uploading..." : "Submit & Unlock Code"}
            </button>
            <p className="text-sm text-gray-500 mt-4">Location will be verified automatically</p>
          </div>
        </div>
      )}

      {/* LEADERBOARD MODAL */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center relative">
            <button
              onClick={() => setShowLeaderboard(false)}
              className="absolute top-6 right-6 text-4xl text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
            <Trophy className="w-16 h-16 text-amber-600 mx-auto mb-6" />
            <h2 className="text-4xl font-black text-amber-900 mb-10">Hackney Top Hunters</h2>

            {loadingLeaderboard ? (
              <div className="py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-amber-600"></div>
              </div>
            ) : leaderboardData.length === 0 ? (
              <p className="text-gray-600 text-xl">No data available yet</p>
            ) : (
              <div className="space-y-6 text-left">
                {leaderboardData.map((user, idx) => (
                  <div
                    key={idx}
                    className={`p-6 rounded-2xl ${
                      idx === 0
                        ? "bg-amber-100"
                        : idx === 1
                        ? "bg-gray-100"
                        : idx === 2
                        ? "bg-orange-50"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-3xl font-black text-gray-700">#{idx + 1}</span>
                        <div>
                          <p className="font-bold text-xl text-gray-800">{user.displayName}</p>
                          <p className="text-sm text-gray-600">{user.tier}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-amber-600">{user.hunts}</p>
                        <p className="text-sm text-gray-600">hunts</p>
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
