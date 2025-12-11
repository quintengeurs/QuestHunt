import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LogOut, Shield, Check, X, MapPin, Camera, Trophy, Flame } from 'lucide-react';

const supabaseUrl = 'https://eeboxlitezqgjyrnssgx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlYm94bGl0ZXpxZ2p5cm5zc2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjcyNTksImV4cCI6MjA4MDI0MzI1OX0.8VlGLHjEv_0aGWOjiDuLLziOCnUqciIAEWayMUGsXT8';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ADMIN_EMAIL = 'quinten.geurs@gmail.com';

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const [hunts, setHunts] = useState([]);
  const [filteredHunts, setFilteredHunts] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [completed, setCompleted] = useState([]);
  const [streak, setStreak] = useState(0);
  const [totalHunts, setTotalHunts] = useState(0);
  const [tier, setTier] = useState('Newbie');
  const [lastActive, setLastActive] = useState(null);
  const [currentHunt, setCurrentHunt] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [selfieFile, setSelfieFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState('hunts');
  const [adminHunts, setAdminHunts] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  // Create Hunt Form
  const [newHuntName, setNewHuntName] = useState('');
  const [newHuntRiddle, setNewHuntRiddle] = useState('');
  const [newHuntCode, setNewHuntCode] = useState('');
  const [newHuntCategory, setNewHuntCategory] = useState('');
  const [newHuntLat, setNewHuntLat] = useState('');
  const [newHuntLon, setNewHuntLon] = useState('');
  const [newHuntRadius, setNewHuntRadius] = useState('50');
  const [newHuntPhoto, setNewHuntPhoto] = useState(null);
  const [creatingHunt, setCreatingHunt] = useState(false);

  // ─── AUTH & ADMIN DETECTION ─────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setIsAdmin(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      if (s?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        setShowAdmin(false);
      }
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  // ─── AUTO REFRESH HUNTS ─────────────────────────
  useEffect(() => {
    if (session && !showAdmin) {
      const interval = setInterval(() => {
        supabase.from('hunts').select('*').order('date', { ascending: false })
          .then(({ data }) => { if (data) setHunts(data); });
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [session, showAdmin]);

  // ─── LOAD USER OR ADMIN DATA ───────────────────
  useEffect(() => {
    if (!session) return;
    if (showAdmin) {
      loadAdminData();
    } else {
      setDataLoaded(false);
      loadProgressAndHunts();
    }
  }, [session, showAdmin]);

  const loadProgressAndHunts = async () => {
    try {
      const { data: progressRows } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', session.user.id)
        .order('last_active', { ascending: false });

      let completedIds = [];
      let currentStreak = 0;
      let currentTotal = 0;
      let lastActiveDate = null;

      if (progressRows?.length > 0) {
        const progress = progressRows[0];
        completedIds = Array.isArray(progress.completed_hunt_ids) ? progress.completed_hunt_ids : [];
        currentStreak = progress.streak || 0;
        currentTotal = progress.total_hunts || completedIds.length;
        lastActiveDate = progress.last_active;
      }

      setCompleted(completedIds);
      setStreak(currentStreak);
      setTotalHunts(currentTotal);
      setLastActive(lastActiveDate);
      setTier(currentTotal >= 20 ? 'Legend' : currentTotal >= 10 ? 'Pro' : currentTotal >= 5 ? 'Hunter' : 'Newbie');

      const { data: huntsData } = await supabase.from('hunts').select('*').order('date', { ascending: false });
      setHunts(huntsData || []);
      applyFilter(huntsData || [], completedIds, activeFilter);
      setDataLoaded(true);
    } catch (e) {
      console.error(e);
      setDataLoaded(true);
    }
  };

  const applyFilter = (allHunts, completedIds, filter) => {
    let filtered = allHunts.filter(h => !completedIds.includes(h.id));
    if (filter !== 'All') filtered = filtered.filter(h => h.category === filter);
    setFilteredHunts(filtered);
  };

  useEffect(() => {
    if (dataLoaded && hunts.length > 0) {
      applyFilter(hunts, completed, activeFilter);
    }
  }, [activeFilter, dataLoaded, completed, hunts]);

  // ─── SELFIE UPLOAD ─────────────────────────────
  const uploadSelfie = async () => {
    if (!selfieFile || !currentHunt || uploading) return;
    setUploading(true);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });

      const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        currentHunt.lat,
        currentHunt.lon
      );

      if (distance > currentHunt.radius) {
        alert('Too far! You must be at the location to submit.');
        setUploading(false);
        return;
      }

      const fileExt = selfieFile.name.split('.').pop();
      const fileName = `${session.user.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('selfies').upload(fileName, selfieFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('selfies').getPublicUrl(fileName);

      await supabase.from('selfies').insert({
        user_id: session.user.id,
        hunt_id: currentHunt.id,
        image_url: publicUrl,
        approved: false,
      });

      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const newStreak = lastActive === today ? streak : lastActive === yesterday ? streak + 1 : 1;

      const newCompleted = [...new Set([...completed, currentHunt.id])];
      const newTotal = newCompleted.length;
      const newTier = newTotal >= 20 ? 'Legend' : newTotal >= 10 ? 'Pro' : newTotal >= 5 ? 'Hunter' : 'Newbie';

      await supabase.from('user_progress').upsert({
        user_id: session.user.id,
        completed_hunt_ids: newCompleted,
        total_hunts: newTotal,
        streak: newStreak,
        tier: newTier,
        last_active: today,
      });

      setCompleted(newCompleted);
      setTotalHunts(newTotal);
      setStreak(newStreak);
      setTier(newTier);
      setLastActive(today);

      setShowModal(false);
      setSelfieFile(null);
      setCurrentHunt(null);
      alert('Selfie submitted! Waiting for admin approval.');
    } catch (error) {
      console.error(error);
      alert(`Upload failed: ${error.message || 'Try again'}`);
    } finally {
      setUploading(false);
    }
  };

  // ─── ADMIN: LOAD DATA ───────────────────────────
  const loadAdminData = async () => {
    const { data: allHunts } = await supabase.from('hunts').select('*');
    setAdminHunts(allHunts || []);

    const { data: subs } = await supabase
      .from('selfies')
      .select('*, hunts(*), profiles:auth.users(email)')
      .order('created_at', { ascending: false });

    setSubmissions(subs || []);
  };

  // ─── CREATE NEW HUNT ───────────────────────────
  const createHunt = async () => {
    if (!newHuntName || !newHuntRiddle || !newHuntCode || !newHuntLat || !newHuntLon) {
      alert('Please fill in all required fields');
      return;
    }

    setCreatingHunt(true);
    try {
      let photoUrl = null;
      if (newHuntPhoto) {
        const fileExt = newHuntPhoto.name.split('.').pop();
        const fileName = `hunt_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('hunts').upload(fileName, newHuntPhoto);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('hunts').getPublicUrl(fileName);
        photoUrl = publicUrl;
      }

      await supabase.from('hunts').insert({
        business_name: newHuntName,
        riddle: newHuntRiddle,
        code: newHuntCode,
        category: newHuntCategory || 'Food & Drink',
        lat: parseFloat(newHuntLat),
        lon: parseFloat(newHuntLon),
        radius: parseInt(newHuntRadius) || 50,
        photo: photoUrl,
        date: new Date().toISOString(),
      });

      alert('Hunt created successfully!');
      setNewHuntName(''); setNewHuntRiddle(''); setNewHuntCode(''); setNewHuntCategory(''); setNewHuntLat(''); setNewHuntLon(''); setNewHuntRadius('50'); setNewHuntPhoto(null);
      loadAdminData();
      setAdminTab('hunts');
    } catch (err) {
      alert('Failed to create hunt: ' + (err.message || 'Unknown error'));
    } finally {
      setCreatingHunt(false);
    }
  };

  const approveSelfie = async (id) => {
    const { data: selfie } = await supabase.from('selfies').select('user_id, hunt_id').eq('id', id).single();
    await supabase.from('selfies').update({ approved: true }).eq('id', id);

    const { data: progress } = await supabase.from('user_progress').select('*').eq('user_id', selfie.user_id).single();
    const newCompleted = [...new Set([...(progress?.completed_hunt_ids || []), selfie.hunt_id])];
    const newTotal = newCompleted.length;
    const newTier = newTotal >= 20 ? 'Legend' : newTotal >= 10 ? 'Pro' : newTotal >= 5 ? 'Hunter' : 'Newbie';

    await supabase.from('user_progress').upsert({
      user_id: selfie.user_id,
      completed_hunt_ids: newCompleted,
      total_hunts: newTotal,
      streak: progress?.streak || 0,
      tier: newTier,
      last_active: new Date().toISOString().slice(0, 10),
    });

    loadAdminData();
  };

  const rejectSelfie = async (id) => {
    await supabase.from('selfies').delete().eq('id', id);
    loadAdminData();
  };

  const signUp = async () => {
    setLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
    setLoading(false);
  };

  const signIn = async () => {
    setLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // ─── ADMIN PANEL ───────────────────────────────
  if (showAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white shadow-2xl p-6 sticky top-0 z-50 flex justify-between items-center border-b-8 border-amber-600">
          <h1 className="text-5xl font-black text-amber-900 flex items-center gap-4">
            <Shield className="w-14 h-14" /> Admin Panel
          </h1>
          <div className="flex gap-4 items-center">
            <button onClick={() => setShowAdmin(false)} className="px-8 py-4 bg-gray-800 hover:bg-gray-900 text-white rounded-full font-bold text-lg">
              Back to App
            </button>
            <button onClick={signOut} className="p-3 bg-red-100 hover:bg-red-200 rounded-full">
              <LogOut size={32} className="text-red-700" />
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-8">
          <div className="flex gap-12 mb-12 border-b-4 border-amber-200">
            <button onClick={() => setAdminTab('hunts')} className={`pb-4 px-6 text-2xl font-bold ${adminTab === 'hunts' ? 'text-amber-600 border-b-4 border-amber-600' : 'text-gray-600'}`}>
              All Hunts ({adminHunts.length})
            </button>
            <button onClick={() => setAdminTab('submissions')} className={`pb-4 px-6 text-2xl font-bold ${adminTab === 'submissions' ? 'text-amber-600 border-b-4 border-amber-600' : 'text-gray-600'}`}>
              Pending ({submissions.filter(s => !s.approved).length})
            </button>
            <button onClick={() => setAdminTab('create')} className={`pb-4 px-6 text-2xl font-bold ${adminTab === 'create' ? 'text-amber-600 border-b-4 border-amber-600' : 'text-gray-600'}`}>
              + Create Hunt
            </button>
          </div>

          {/* ALL HUNTS TAB */}
          {adminTab === 'hunts' && (
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {adminHunts.length === 0 ? (
                <p className="col-span-full text-center text-3xl text-gray-500 py-20">No hunts yet. Create one!</p>
              ) : (
                adminHunts.map(hunt => (
                  <div key={hunt.id} className="bg-white rounded-3xl shadow-2xl overflow-hidden transform hover:scale-105 transition">
                    {hunt.photo ? (
                      <img src={hunt.photo} alt={hunt.business_name} className="w-full h-64 object-cover" />
                    ) : (
                      <div className="bg-gray-200 border-2 border-dashed rounded-t-3xl w-full h-64 flex items-center justify-center">
                        <p className="text-gray-500">No photo</p>
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-2xl font-black text-amber-900 mb-3">{hunt.business_name}</h3>
                      <p className="text-gray-600 text-lg italic mb-4">"{hunt.riddle}"</p>
                      <div className="text-sm space-y-1">
                        <p><strong>Category:</strong> {hunt.category || '—'}</p>
                        <p><strong>Code:</strong> <span className="font-mono bg-green-100 px-2 py-1 rounded">{hunt.code}</span></p>
                        <p><strong>Location:</strong> {hunt.lat.toFixed(6)}, {hunt.lon.toFixed(6)}</p>
                        <p><strong>Radius:</strong> {hunt.radius}m</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* CREATE HUNT TAB */}
          {adminTab === 'create' && (
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-3xl mx-auto">
              <h2 className="text-4xl font-black text-amber-900 mb-10 text-center">Create New Hunt</h2>
              <div className="space-y-6">
                <input type="text" placeholder="Business Name *" value={newHuntName} onChange={e => setNewHuntName(e.target.value)} className="w-full p-5 border-2 border-amber-300 rounded-2xl text-xl focus:border-amber-600 outline-none" />
                <textarea placeholder="Riddle / Clue *" value={newHuntRiddle} onChange={e => setNewHuntRiddle(e.target.value)} className="w-full p-5 border-2 border-amber-300 rounded-2xl text-xl h-32 focus:border-amber-600 outline-none" />
                <input type="text" placeholder="Secret Code (e.g. BREW2025) *" value={newHuntCode} onChange={e => setNewHuntCode(e.target.value)} className="w-full p-5 border-2 border-amber-300 rounded-2xl text-xl focus:border-amber-600 outline-none" />
                <input type="text" placeholder="Category (e.g. Coffee, Bar)" value={newHuntCategory} onChange={e => setNewHuntCategory(e.target.value)} className="w-full p-5 border-2 border-amber-300 rounded-2xl text-xl focus:border-amber-600 outline-none" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Latitude *" value={newHuntLat} onChange={e => setNewHuntLat(e.target.value)} className="p-5 border-2 border-amber-300 rounded-2xl text-xl focus:border-amber-600 outline-none" />
                  <input type="text" placeholder="Longitude *" value={newHuntLon} onChange={e => setNewHuntLon(e.target.value)} className="p-5 border-2 border-amber-300 rounded-2xl text-xl focus:border-amber-600 outline-none" />
                </div>
                <input type="number" placeholder="Radius in meters (default: 50)" value={newHuntRadius} onChange={e => setNewHuntRadius(e.target.value)} className="w-full p-5 border-2 border-amber-300 rounded-2xl text-xl focus:border-amber-600 outline-none" />
                <input type="file" accept="image/*" onChange={e => setNewHuntPhoto(e.target.files[0])} className="w-full p-5 border-2 border-dashed border-amber-400 rounded-2xl bg-amber-50 text-lg" />
                <button onClick={createHunt} disabled={creatingHunt} className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white py-6 rounded-2xl font-bold text-2xl shadow-2xl transform hover:scale-105 transition">
                  {creatingHunt ? 'Creating Hunt...' : 'Create Hunt'}
                </button>
              </div>
            </div>
          )}

          {/* SUBMISSIONS TAB */}
          {adminTab === 'submissions' && submissions.filter(s => !s.approved).length === 0 && (
            <p className="text-center text-4xl text-gray-500 py-32 font-light">No pending submissions</p>
          )}

          {adminTab === 'submissions' && submissions.filter(s => !s.approved).map(sub => (
            <div key={sub.id} className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row mb-12">
              <img src={sub.image_url} alt="Selfie" className="w-full lg:w-96 h-96 object-cover" />
              <div className="p-8 lg:p-12 flex-1 flex flex-col justify-center">
                <p className="text-2xl font-bold mb-2">User: {sub.profiles?.email || sub.user_id}</p>
                <p className="text-xl text-gray-700 mb-2">Hunt: {sub.hunts?.business_name}</p>
                <p className="text-gray-600">Submitted: {new Date(sub.created_at).toLocaleString()}</p>
                <div className="flex gap-6 mt-10">
                  <button onClick={() => approveSelfie(sub.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-6 rounded-2xl font-bold text-2xl flex items-center justify-center gap-4 shadow-xl">
                    <Check size={36} /> Approve
                  </button>
                  <button onClick={() => rejectSelfie(sub.id)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-6 rounded-2xl font-bold text-2xl flex items-center justify-center gap-4 shadow-xl">
                    <X size={36} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── LOGIN & LOADING ───────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
          <h1 className="text-7xl font-black text-amber-900 mb-4">Brew Hunt</h1>
          <p className="text-2xl text-amber-800 mb-12">Real-world treasure hunts in Hackney</p>
          {authError && <p className="text-red-600 font-bold mb-6 text-lg">{authError}</p>}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 mb-4 border-2 border-amber-200 rounded-2xl text-lg" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 mb-8 border-2 border-amber-200 rounded-2xl text-lg" />
          <button onClick={signUp} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-6 rounded-2xl font-bold text-2xl mb-4 shadow-lg">
            {loading ? 'Creating...' : 'Sign Up Free'}
          </button>
          <button onClick={signIn} disabled={loading} className="w-full bg-gray-800 hover:bg-gray-900 text-white py-6 rounded-2xl font-bold text-2xl shadow-lg">
            Log In
          </button>
        </div>
      </div>
    );
  }

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50 flex items-center justify-center">
        <p className="text-3xl font-bold text-amber-900 animate-pulse">Loading your adventure...</p>
      </div>
    );
  }

  const activeHuntsCount = hunts.filter(h => !completed.includes(h.id)).length;
  const completedHunts = hunts.filter(h => completed.includes(h.id));

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50">
      {/* HEADER */}
      <div className="bg-white/95 backdrop-blur-xl shadow-2xl border-b-8 border-amber-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-6 flex justify-between items-center">
          <h1 className="text-5xl md:text-6xl font-black text-amber-900 tracking-tighter">Brew Hunt</h1>
          <div className="flex items-center gap-5">
            {isAdmin && (
              <button
                onClick={() => setShowAdmin(true)}
                className="group relative overflow-hidden rounded-2xl font-black transition-all duration-300 shadow-2xl
                           flex items-center gap-3 px-8 py-4
                           bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700
                           text-white hover:shadow-amber-500/50 transform hover:scale-105"
              >
                <Shield className="w-8 h-8" />
                <span className="hidden md:block text-xl">Admin Panel</span>
                <span className="md:hidden text-lg">Admin</span>
                <div className="absolute inset-0 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              </button>
            )}
            <button onClick={signOut} className="p-4 rounded-full bg-gray-100 hover:bg-gray-200 transition shadow-lg" title="Log out">
              <LogOut className="w-7 h-7 text-gray-700" />
            </button>
          </div>
        </div>
      </div>

      {/* STATS CARD */}
      <div className="max-w-md mx-auto p-6">
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-10 text-center mb-8 border-4 border-amber-200">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-7xl font-black text-orange-600 flex items-center gap-3">
                {streak} <Flame className="w-16 h-16" />
              </div>
              <p className="text-2xl text-gray-700 font-semibold mt-2">Day Streak</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-black text-purple-600 flex items-center gap-3 justify-end">
                <Trophy className="w-14 h-14" /> {tier}
              </div>
              <button onClick={() => setShowCompletedModal(true)} className="text-xl underline text-gray-700 mt-4 block">
                {totalHunts} completed • {activeHuntsCount} active
              </button>
            </div>
          </div>
        </div>

        {/* HUNT CARDS — FINAL PERFECT LAYOUT */}
        <div className="space-y-8">
          {filteredHunts.map(hunt => {
            const isCompleted = completed.includes(hunt.id);
            return (
              <div
                key={hunt.id}
                className={`bg-white rounded-3xl shadow-2xl overflow-hidden transform transition hover:scale-105 relative ${
                  isCompleted ? 'opacity-80' : ''
                }`}
              >
                {/* COMPLETED RIBBON */}
                {isCompleted && (
                  <div className="absolute top-0 right-0 bg-green-600 text-white px-10 py-3 rounded-bl-3xl font-black text-xl z-20 shadow-lg transform rotate-12 translate-x-6 -translate-y-2">
                    COMPLETED
                  </div>
                )}

                {/* IMAGE + CATEGORY TAG */}
                <div className="relative">
                  {hunt.photo ? (
                    <img src={hunt.photo} alt={hunt.business_name} className="w-full h-64 object-cover" />
                  ) : (
                    <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
                      <p className="text-gray-500 text-xl">No photo</p>
                    </div>
                  )}
                  <span className="absolute top-4 left-4 bg-amber-500 text-white px-5 py-2 rounded-full font-bold text-sm shadow-lg z-10">
                    {hunt.category}
                  </span>
                </div>

                {/* CONTENT + CENTERED BUTTON */}
                <div className="p-8 pb-12 text-center">
                  <h3 className="text-3xl font-black text-amber-900 mb-4">{hunt.business_name}</h3>
                  <p className="text-gray-600 text-lg italic mb-10 leading-relaxed">"{hunt.riddle}"</p>

                  <button
                    onClick={() => { setCurrentHunt(hunt); setShowModal(true); }}
                    disabled={isCompleted}
                    className={`w-full max-w-xs mx-auto px-10 py-5 rounded-full font-bold text-xl shadow-2xl flex items-center justify-center gap-3 transition-all ${
                      isCompleted
                        ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                        : 'bg-amber-600 hover:bg-amber-700 text-white hover:shadow-amber-500/50'
                    }`}
                  >
                    <MapPin size={24} />
                    {isCompleted ? 'Completed' : 'Start Hunt'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* COMPLETED HUNTS MODAL */}
      {showCompletedModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6" onClick={() => setShowCompletedModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-screen overflow-y-auto p-10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-5xl font-black text-amber-900">Completed Hunts</h2>
              <button onClick={() => setShowCompletedModal(false)} className="text-gray-600 hover:text-gray-900">
                <X size={36} />
              </button>
            </div>
            {completedHunts.length === 0 ? (
              <p className="text-center text-2xl text-gray-500 py-20">No completed hunts yet. Keep hunting!</p>
            ) : (
              <div className="grid gap-6">
                {completedHunts.map(hunt => (
                  <div key={hunt.id} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-3xl p-6 border-4 border-green-300 flex items-center gap-6">
                    {hunt.photo && <img src={hunt.photo} alt={hunt.business_name} className="w-32 h-32 object-cover rounded-2xl" />}
                    <div>
                      <h3 className="text-2xl font-black text-green-800">{hunt.business_name}</h3>
                      <p className="text-green-700 italic">"{hunt.riddle}"</p>
                      <p className="text-sm text-green-600 mt-2">Category: {hunt.category}</p>
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-10 text-center">
            <h2 className="text-4xl font-black text-amber-900 mb-6">Submit Proof</h2>
            <p className="text-xl mb-8">Take a selfie at:</p>
            <p className="text-2xl font-bold text-amber-700 mb-10">{currentHunt.business_name}</p>
            <input type="file" accept="image/*" capture="camera" onChange={e => setSelfieFile(e.target.files[0])} className="mb-8" />
            <div className="flex gap-6">
              <button onClick={() => { setShowModal(false); setSelfieFile(null); }} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-5 rounded-2xl font-bold text-xl">
                Cancel
              </button>
              <button
                onClick={uploadSelfie}
                disabled={!selfieFile || uploading}
                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3"
              >
                <Camera /> {uploading ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
