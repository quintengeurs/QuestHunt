import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LogOut, Trophy, Shield, Check, X } from 'lucide-react';

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
  const [showLeaderboard, setShowLeaderboard] = useState(false);
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
  const [newHuntDate, setNewHuntDate] = useState('');
  const [newHuntCategory, setNewHuntCategory] = useState('');
  const [newHuntRiddle, setNewHuntRiddle] = useState('');
  const [newHuntBusinessName, setNewHuntBusinessName] = useState('');
  const [newHuntCode, setNewHuntCode] = useState('');
  const [newHuntDiscount, setNewHuntDiscount] = useState('');
  const [newHuntLat, setNewHuntLat] = useState('');
  const [newHuntLon, setNewHuntLon] = useState('');
  const [newHuntRadius, setNewHuntRadius] = useState('50');
  const [newHuntPhoto, setNewHuntPhoto] = useState(null);
  const [creatingHunt, setCreatingHunt] = useState(false);

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

  useEffect(() => {
    if (session) {
      setDataLoaded(false);
      loadProgressAndHunts();
      const interval = setInterval(fetchHunts, 10000);
      return () => clearInterval(interval);
    }
  }, [session]);

  useEffect(() => {
    if (dataLoaded && hunts.length > 0) {
      applyFilter(hunts, completed, activeFilter);
    }
  }, [activeFilter, dataLoaded, completed, hunts]);

  const loadProgressAndHunts = async () => {
    try {
      const { data: progressRows } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', session.user.id)
        .order('last_active', { ascending: false });

      let completedIds = [];
      const progress = progressRows?.[0] || null;

      if (progress) {
        completedIds = Array.isArray(progress.completed_hunt_ids) ? progress.completed_hunt_ids : [];
        if (progressRows.length > 1) {
          const all = new Set();
          let maxTotal = 0, maxStreak = 0;
          progressRows.forEach(r => {
            if (Array.isArray(r.completed_hunt_ids)) r.completed_hunt_ids.forEach(id => all.add(id));
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
        setTier(completedIds.length >= 20 ? 'Legend' : completedIds.length >= 10 ? 'Pro' : completedIds.length >= 5 ? 'Hunter' : 'Newbie');
        setLastActive(progress.last_active || null);
      } else {
        setCompleted([]);
        setStreak(0);
        setTotalHunts(0);
        setTier('Newbie');
        setLastActive(null);
      }

      const { data: huntsData } = await supabase.from('hunts').select('*').order('date', { ascending: false });
      setHunts(huntsData || []);
      applyFilter(huntsData || [], completedIds, activeFilter);
      setDataLoaded(true);
    } catch (e) {
      console.error(e);
      setDataLoaded(true);
    }
  };

  const fetchHunts = async () => {
    const { data } = await supabase.from('hunts').select('*').order('date', { ascending: false });
    setHunts(data || []);
  };

  const applyFilter = (allHunts, completedIds, filterCategory) => {
    let filtered = allHunts.filter(h => !completedIds.includes(h.id));
    if (filterCategory !== 'All') filtered = filtered.filter(h => h.category === filterCategory);
    setFilteredHunts(filtered);
  };

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
        alert('You are not at the spot!');
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
      });

      const newCompleted = [...new Set([...completed, currentHunt.id])];
      const newTotal = totalHunts + 1;

      const today = new Date().toISOString().slice(0, 10);
      let newStreak = 1;
      if (lastActive) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);
        if (lastActive === yesterdayStr) newStreak = streak + 1;
        else if (lastActive === today) newStreak = streak;
      }

      const newTier = newTotal >= 20 ? 'Legend' : newTotal >= 10 ? 'Pro' : newTotal >= 5 ? 'Hunter' : 'Newbie';

      await supabase.from('user_progress').upsert({
        user_id: session.user.id,
        completed_hunt_ids: newCompleted,
        total_hunts: newTotal,
        streak: newStreak,
        tier: newTier,
        last_active: today,
      }, { onConflict: 'user_id' });

      setCompleted(newCompleted);
      setTotalHunts(newTotal);
      setStreak(newStreak);
      setTier(newTier);
      setLastActive(today);

      setShowModal(false);
      setSelfieFile(null);
      setCurrentHunt(null);
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const loadAdminData = async () => {
    const { data: allHunts } = await supabase.from('hunts').select('*');
    setAdminHunts(allHunts || []);

    const { data: subs } = await supabase
      .from('selfies')
      .select('*, hunts(*), profiles:auth.users(email)')
      .order('created_at', { ascending: false });
    setSubmissions(subs || []);
  };

  const createHunt = async () => {
    if (!newHuntBusinessName || !newHuntRiddle || !newHuntCode || !newHuntLat || !newHuntLon) {
      alert('Please fill all required fields');
      return;
    }

    setCreatingHunt(true);
    try {
      let photoUrl = null;
      if (newHuntPhoto) {
        const fileExt = newHuntPhoto.name.split('.').pop();
        const fileName = `hunt_${Date.now()}.${fileExt}`;
        const path = `hunts/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('selfies').upload(path, newHuntPhoto);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('selfies').getPublicUrl(path);
        photoUrl = publicUrl;
      }

      const huntDate = newHuntDate || new Date().toISOString().slice(0, 10);

      await supabase.from('hunts').insert({
        date: huntDate,
        category: newHuntCategory || 'Food & Drink',
        riddle: newHuntRiddle,
        business_name: newHuntBusinessName,
        code: newHuntCode,
        discount: newHuntDiscount || '',
        photo: photoUrl,
        lat: parseFloat(newHuntLat),
        lon: parseFloat(newHuntLon),
        radius: parseInt(newHuntRadius) || 50,
      });

      alert('Hunt created successfully!');
      setNewHuntDate(''); setNewHuntCategory(''); setNewHuntRiddle(''); setNewHuntBusinessName('');
      setNewHuntCode(''); setNewHuntDiscount(''); setNewHuntLat(''); setNewHuntLon(''); setNewHuntRadius('50'); setNewHuntPhoto(null);
      loadAdminData();
      setAdminTab('hunts');
    } catch (err) {
      alert('Failed: ' + (err.message || 'Unknown error'));
    } finally {
      setCreatingHunt(false);
    }
  };

  const approveSelfie = async (id) => {
    await supabase.from('selfies').update({ approved: true }).eq('id', id);
    loadAdminData();
  };

  const rejectSelfie = async (id) => {
    await supabase.from('selfies').delete().eq('id', id);
    loadAdminData();
  };

  const signUp = async () => {
    setLoading(true); setAuthError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
    setLoading(false);
  };

  const signIn = async () => {
    setLoading(true); setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // ADMIN PANEL
  if (showAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white shadow-xl p-6 sticky top-0 z-50 flex justify-between items-center">
          <h1 className="text-4xl font-black text-amber-900 flex items-center gap-4">
            <Shield size={40} /> Admin Panel
          </h1>
          <div className="flex gap-4">
            <button onClick={() => setShowAdmin(false)} className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-full font-bold">
              Back to App
            </button>
            <button onClick={signOut}><LogOut size={28} /></button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-8">
          <div className="flex gap-8 mb-12 border-b-4 border-amber-200">
            <button onClick={() => setAdminTab('hunts')} className={`pb-4 px-6 text-2xl font-bold ${adminTab === 'hunts' ? 'text-amber-600 border-b-4 border-amber-600' : 'text-gray-600'}`}>
              Active Hunts ({adminHunts.length})
            </button>
            <button onClick={() => setAdminTab('submissions')} className={`pb-4 px-6 text-2xl font-bold ${adminTab === 'submissions' ? 'text-amber-600 border-b-4 border-amber-600' : 'text-gray-600'}`}>
              Submissions ({submissions.filter(s => !s.approved).length})
            </button>
            <button onClick={() => setAdminTab('create')} className={`pb-4 px-6 text-2xl font-bold ${adminTab === 'create' ? 'text-amber-600 border-b-4 border-amber-600' : 'text-gray-600'}`}>
              + Create Hunt
            </button>
          </div>

          {/* ACTIVE HUNTS */}
          {adminTab === 'hunts' && (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {adminHunts.map(hunt => (
                <div key={hunt.id} className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                  {hunt.photo && <img src={hunt.photo} alt="" className="w-full h-64 object-cover" />}
                  <div className="p-6">
                    <h3 className="text-2xl font-black text-amber-900 mb-2">{hunt.business_name}</h3>
                    <p className="text-gray-600 italic mb-4">"{hunt.riddle}"</p>
                    <p className="text-sm"><strong>Code:</strong> {hunt.code}</p>
                    <p className="text-sm"><strong>Date:</strong> {new Date(hunt.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUBMISSIONS */}
          {adminTab === 'submissions' && submissions.filter(s => !s.approved).map(sub => (
            <div key={sub.id} className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row mb-8">
              <img src={sub.image_url} alt="Selfie" className="w-full lg:w-96 h-96 object-cover" />
              <div className="p-8 flex-1 flex flex-col justify-center">
                <p className="text-xl mb-2"><strong>User:</strong> {sub.profiles?.email || sub.user_id}</p>
                <p className="text-xl mb-8"><strong>Hunt:</strong> {sub.hunts?.business_name}</p>
                <div className="flex gap-6">
                  <button onClick={() => approveSelfie(sub.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3">
                    Approve
                  </button>
                  <button onClick={() => rejectSelfie(sub.id)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3">
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* CREATE HUNT */}
          {adminTab === 'create' && (
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-4xl mx-auto">
              <h2 className="text-4xl font-black text-amber-900 mb-10 text-center">Create New Hunt</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <input type="date" value={newHuntDate} onChange={e => setNewHuntDate(e.target.value)} className="p-5 border-2 border-amber-200 rounded-2xl text-lg" placeholder="Active from date" />
                <input type="text" value={newHuntCategory} onChange={e => setNewHuntCategory(e.target.value)} className="p-5 border-2 border-amber-200 rounded-2xl text-lg" placeholder="Category (e.g. Café)" />
                <input type="text" value={newHuntBusinessName} onChange={e => setNewHuntBusinessName(e.target.value)} className="p-5 border-2 border-amber-200 rounded-2xl text-lg" placeholder="Business Name *" />
                <textarea value={newHuntRiddle} onChange={e => setNewHuntRiddle(e.target.value)} className="p-5 border-2 border-amber-200 rounded-2xl text-lg h-32" placeholder="Riddle / Clue *" />
                <input type="text" value={newHuntCode} onChange={e => setNewHuntCode(e.target.value)} className="p-5 border-2 border-amber-200 rounded-2xl text-lg" placeholder="Secret Code (e.g. BREW2025) *" />
                <input type="text" value={newHuntDiscount} onChange={e => setNewHuntDiscount(e.target.value)} className="p-5 border-2 border-amber-200 rounded-2xl text-lg" placeholder="Discount (e.g. Free coffee)" />
                <input type="text" value={newHuntLat} onChange={e => setNewHuntLat(e.target.value)} className="p-5 border-2 border-amber-200 rounded-2xl text-lg" placeholder="Latitude *" />
                <input type="text" value={newHuntLon} onChange={e => setNewHuntLon(e.target.value)} className="p-5 border-2 border-amber-200 rounded-2xl text-lg" placeholder="Longitude *" />
                <input type="number" value={newHuntRadius} onChange={e => setNewHuntRadius(e.target.value)} className="p-5 border-2 border-amber-200 rounded-2xl text-lg" placeholder="Radius (meters)" />
                <input type="file" accept="image/*" onChange={e => setNewHuntPhoto(e.target.files?.[0] || null)} className="col-span-2 p-5 border-2 border-dashed border-amber-300 rounded-2xl bg-amber-50" />
              </div>
              <button onClick={createHunt} disabled={creatingHunt} className="mt-10 w-full bg-amber-600 hover:bg-amber-700 text-white py-6 rounded-2xl font-black text-2xl shadow-xl">
                {creatingHunt ? 'Creating...' : 'Create Hunt'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // MAIN APP (your original beautiful design)
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
          <h1 className="text-6xl font-black text-amber-900 mb-4">Brew Hunt</h1>
          <p className="text-xl text-amber-800 mb-12">Real-world treasure hunts in Hackney</p>
          {authError && <p className="text-red-600 font-bold mb-6">{authError}</p>}
          <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 mb-4 border-2 border-amber-200 rounded-2xl text-lg" />
          <input type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 mb-8 border-2 border-amber-200 rounded-2xl text-lg" />
          <button onClick={signUp} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white py-6 rounded-2xl font-bold text-2xl shadow-lg mb-4">
            {loading ? 'Creating...' : 'Sign Up Free'}
          </button>
          <button onClick={signIn} disabled={loading} className="w-full bg-gray-700 hover:bg-gray-800 disabled:opacity-60 text-white py-6 rounded-2xl font-bold text-2xl shadow-lg">
            Log In
          </button>
        </div>
      </div>
    );
  }

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50 flex items-center justify-center">
        <p className="text-2xl text-amber-900 font-bold">Loading your hunts...</p>
      </div>
    );
  }

  const activeHuntsCount = hunts.filter(h => !completed.includes(h.id)).length;
  const completedHunts = hunts.filter(h => completed.includes(h.id));

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg shadow-lg p-6 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <h1 className="text-4xl font-black text-amber-900">Brew Hunt</h1>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <button onClick={() => setShowAdmin(true)} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg">
                Admin
              </button>
            )}
            <button onClick={signOut}><LogOut size={28} className="text-gray-600" /></button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-md mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-6xl font-black text-orange-600">{streak}</div>
              <p className="text-gray-600">day streak</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-purple-600">{tier}</div>
              <button onClick={() => setShowCompletedModal(true)} className="text-xl underline text-gray-700">
                {totalHunts} completed · {activeHuntsCount} active
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-md mx-auto px-6">
        <div className="flex flex-wrap gap-3 justify-center mb-8">
          {['All', 'Café', 'Barber', 'Restaurant', 'Gig', 'Museum'].map(cat => (
            <button key={cat} onClick={() => filterHunts(cat)} className={`px-6 py-3 rounded-full font-bold transition shadow-lg ${activeFilter === cat ? 'bg-amber-600 text-white' : 'bg-white text-gray-700'}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="text-center mb-8">
          <button onClick={() => setShowLeaderboard(true)} className="text-amber-700 underline font-bold text-xl flex items-center gap-2 mx-auto">
            Leaderboard
          </button>
        </div>

        {/* Hunts */}
        <div className="space-y-8 pb-24">
          {filteredHunts.length === 0 ? (
            <p className="text-center text-gray-600 text-xl py-12">No {activeFilter === 'All' ? '' : activeFilter} hunts right now — check back soon!</p>
          ) : (
            filteredHunts.map(hunt => (
              <div key={hunt.id} className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="relative">
                  <img src={hunt.photo || "https://picsum.photos/400/300"} alt="Clue" className="w-full h-72 object-cover" />
                </div>
                <div className="p-8">
                  <span className="inline-block px-5 py-2 bg-amber-200 text-amber-800 rounded-full text-sm font-bold mb-4">
                    {hunt.category}
                  </span>
                  <p className="text-2xl font-bold mb-4 text-gray-800">{hunt.riddle}</p>
                  <p className="text-xl font-medium text-gray-700 mb-2">{hunt.business_name}</p>
                  <p className="text-lg text-gray-600 mb-8">{hunt.discount}</p>
                  <button onClick={() => startHunt(hunt)} className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-2xl font-black text-2xl shadow-xl">
                    I'm at the spot!
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals remain exactly as your original */}
      {showCompletedModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center relative max-h-screen overflow-y-auto">
            <button onClick={() => setShowCompletedModal(false)} className="absolute top-6 right-6 text-4xl text-gray-500">&times;</button>
            <h2 className="text-4xl font-black text-amber-900 mb-10">Your Completed Hunts ({totalHunts})</h2>
            {completedHunts.length === 0 ? (
              <p className="text-gray-600 text-xl">No completed hunts yet — get hunting!</p>
            ) : (
              <div className="space-y-8">
                {completedHunts.map(hunt => (
                  <div key={hunt.id} className="bg-gray-50 rounded-2xl p-6">
                    <img src={hunt.photo || "https://picsum.photos/400/300"} alt="Clue" className="w-full h-48 object-cover rounded-xl mb-4" />
                    <p className="text-xl font-bold text-gray-800 mb-2">{hunt.riddle}</p>
                    <p className="text-lg text-gray-700 mb-2">{hunt.business_name}</p>
                    <p className="text-green-600 font-black text-lg">{hunt.code}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center relative">
            <button onClick={() => { setShowModal(false); setSelfieFile(null); }} className="absolute top-6 right-6 text-4xl text-gray-500">&times;</button>
            <h3 className="text-4xl font-black text-gray-800 mb-6">Show the logo!</h3>
            <p className="text-xl text-gray-600 mb-10">Win £50 weekly for best selfie!</p>
            <input type="file" accept="image/*" capture="environment" onChange={e => setSelfieFile(e.target.files?.[0] || null)} className="hidden" id="camera" />
            <label htmlFor="camera" className="w-44 h-44 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center shadow-2xl text-5xl cursor-pointer mx-auto mb-12">
              <span className="text-2xl font-bold">Camera</span>
            </label>
            <button onClick={uploadSelfie} disabled={!selfieFile || uploading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-6 rounded-2xl font-black text-2xl shadow-xl">
              {uploading ? 'Uploading...' : 'Submit & Unlock'}
            </button>
          </div>
        </div>
      )}

      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center relative">
            <button onClick={() => setShowLeaderboard(false)} className="absolute top-6 right-6 text-4xl text-gray-500">&times;</button>
            <h2 className="text-4xl font-black text-amber-900 mb-10">Hackney Top Hunters</h2>
            <div className="space-y-6 text-2xl font-bold">
              <div>1. Alex — 42 hunts</div>
              <div>2. Sam — 38 hunts</div>
              <div>3. Jordan — 35 hunts</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
