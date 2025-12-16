import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LogOut, Trophy } from 'lucide-react';

const supabaseUrl = 'https://eeboxlitezqgjyrnssgx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlYm94bGl0ZXpxZ2p5cm5zc2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjcyNTksImV4cCI6MjA4MDI0MzI1OX0.8VlGLHjEv_0aGWOjiDuLLziOCnUqciIAEWayMUGsXT8';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
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
  const [completed, setCompleted] = useState([]); // array of hunt IDs
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
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

  // Re-apply filter whenever hunts, completed, or activeFilter changes
  useEffect(() => {
    if (dataLoaded && hunts.length > 0) {
      applyFilter(hunts, completed, activeFilter);
    }
  }, [activeFilter, dataLoaded]);

  // Separate effect for when completed changes
  useEffect(() => {
    if (dataLoaded && hunts.length > 0) {
      applyFilter(hunts, completed, activeFilter);
    }
  }, [completed]);

  const loadProgressAndHunts = async () => {
    try {
      // Load user progress - get all rows and take the most recent
      const { data: progressRows, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', session.user.id)
        .order('last_active', { ascending: false });

      if (progressError) {
        console.error('Error loading progress:', progressError);
      }

      let completedIds = [];
      // Take the first (most recent) row if multiple exist
      const progress = progressRows && progressRows.length > 0 ? progressRows[0] : null;
      
      if (progress) {
        completedIds = Array.isArray(progress.completed_hunt_ids) ? progress.completed_hunt_ids : [];
        console.log('Loaded progress:', progress); // Debug log
        
        // If there are multiple rows, merge all completed hunt IDs
        if (progressRows.length > 1) {
          console.log(`Warning: Found ${progressRows.length} progress rows, merging data`);
          const allCompleted = new Set();
          let maxTotal = 0;
          let maxStreak = 0;
          
          progressRows.forEach(row => {
            if (Array.isArray(row.completed_hunt_ids)) {
              row.completed_hunt_ids.forEach(id => allCompleted.add(id));
            }
            maxTotal = Math.max(maxTotal, row.total_hunts || 0);
            maxStreak = Math.max(maxStreak, row.streak || 0);
          });
          
          completedIds = Array.from(allCompleted);
          
          setCompleted(completedIds);
          setStreak(maxStreak);
          setTotalHunts(completedIds.length); // Use actual count
          setTier(completedIds.length >= 20 ? 'Legend' : completedIds.length >= 10 ? 'Pro' : completedIds.length >= 5 ? 'Hunter' : 'Newbie');
          setLastActive(progress.last_active || null);
        } else {
          setCompleted(completedIds);
          setStreak(progress.streak || 0);
          setTotalHunts(progress.total_hunts || 0);
          setTier(progress.tier || 'Newbie');
          setLastActive(progress.last_active || null);
        }
      } else {
        console.log('No progress found, using defaults'); // Debug log
        setCompleted([]);
        setStreak(0);
        setTotalHunts(0);
        setTier('Newbie');
        setLastActive(null);
      }

      // Load hunts
      const { data: huntsData, error: huntsError } = await supabase
        .from('hunts')
        .select('*')
        .order('date', { ascending: false });

      if (huntsError) {
        console.error('Error loading hunts:', huntsError);
      }

      const allHunts = huntsData || [];
      setHunts(allHunts);
      applyFilter(allHunts, completedIds, activeFilter);
      setDataLoaded(true);
    } catch (error) {
      console.error('Error in loadProgressAndHunts:', error);
      setDataLoaded(true);
    }
  };

  const fetchHunts = async () => {
    const { data } = await supabase.from('hunts').select('*').order('date', { ascending: false });
    setHunts(data || []);
    // Filter will be re-applied by useEffect
  };

  const applyFilter = (allHunts, completedIds, filterCategory) => {
    let filtered = allHunts.filter(h => !completedIds.includes(h.id));

    if (filterCategory !== 'All') {
      filtered = filtered.filter(h => h.category === filterCategory);
    }

    setFilteredHunts(filtered);
  };

  const filterHunts = (cat) => {
    setActiveFilter(cat);
    // Filter will be re-applied by useEffect
  };

  const startHunt = (hunt) => {
    setCurrentHunt(hunt);
    setShowModal(true);
  };

  const uploadSelfie = async () => {
    if (!selfieFile || !currentHunt || uploading) return;

    setUploading(true);
    try {
      // Get user's location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });

      const userLat = position.coords.latitude;
      const userLon = position.coords.longitude;

      const distance = calculateDistance(userLat, userLon, currentHunt.lat, currentHunt.lon);

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

        if (lastActive === yesterdayStr) {
          newStreak = streak + 1;
        } else if (lastActive === today) {
          newStreak = streak;
        } else {
          newStreak = 1;
        }
      }

      const newTier = newTotal >= 20 ? 'Legend' : newTotal >= 10 ? 'Pro' : newTotal >= 5 ? 'Hunter' : 'Newbie';

      console.log('Upserting progress:', { // Debug log
        user_id: session.user.id,
        completed_hunt_ids: newCompleted,
        total_hunts: newTotal,
        streak: newStreak,
        tier: newTier,
        last_active: today,
      });

      const { data: upsertData, error: upsertError } = await supabase
        .from('user_progress')
        .upsert({
          user_id: session.user.id,
          completed_hunt_ids: newCompleted,
          total_hunts: newTotal,
          streak: newStreak,
          tier: newTier,
          last_active: today,
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Upsert error:', upsertError);
        throw upsertError;
      }

      console.log('Progress saved successfully'); // Debug log

      setCompleted(newCompleted);
      setTotalHunts(newTotal);
      setStreak(newStreak);
      setTier(newTier);
      setLastActive(today);

      setShowModal(false);
      setSelfieFile(null);
      setCurrentHunt(null);

      // Filter will be re-applied by useEffect when completed changes
    } catch (error) {
      if (error.code === 1) {
        alert('Location access is required to complete the hunt.');
      } else {
        alert('Upload failed: ' + error.message);
      }
    } finally {
      setUploading(false);
    }
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
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error);
    setSession(null);
  };

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
          <button onClick={signOut}><LogOut size={28} className="text-gray-600" /></button>
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

      {/* Completed Hunts Modal */}
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

      {/* Selfie Modal */}
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

      {/* Leaderboard */}
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



import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LogOut, Trophy, Shield, Check, X, AlertCircle } from 'lucide-react';

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

function getTodayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayLocalDate() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [error, setError] = useState('');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState('hunts');
  const [adminHunts, setAdminHunts] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [processingSubmission, setProcessingSubmission] = useState(null);

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

  // ─── REALTIME SUBSCRIPTIONS ─────────────────────
  useEffect(() => {
    if (!session || showAdmin) return;

    const huntsChannel = supabase
      .channel('hunts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hunts' }, () => {
        fetchHunts();
      })
      .subscribe();

    const progressChannel = supabase
      .channel('progress-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'user_progress',
        filter: `user_id=eq.${session.user.id}`
      }, () => {
        loadProgressAndHunts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(huntsChannel);
      supabase.removeChannel(progressChannel);
    };
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
      setError('');
      const { data: progressRows, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', session.user.id)
        .order('last_active', { ascending: false });

      if (progressError) throw progressError;

      let completedIds = [];
      const progress = progressRows?.[0] || null;

      if (progress) {
        completedIds = Array.isArray(progress.completed_hunt_ids) ? progress.completed_hunt_ids : [];
        
        if (progressRows.length > 1) {
          // Handle duplicate records - merge and clean up
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
          
          // Clean up duplicates (keep only the first one)
          for (let i = 1; i < progressRows.length; i++) {
            await supabase.from('user_progress').delete().eq('id', progressRows[i].id);
          }
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

      const today = getTodayLocalDate();
      const { data: huntsData, error: huntsError } = await supabase
        .from('hunts')
        .select('*')
        .lte('date', today)
        .order('date', { ascending: false });

      if (huntsError) throw huntsError;

      setHunts(huntsData || []);
      applyFilter(huntsData || [], completedIds, activeFilter);
      setDataLoaded(true);
    } catch (e) {
      console.error('Load error:', e);
      setError('Failed to load hunts. Please refresh the page.');
      setDataLoaded(true);
    }
  };

  const fetchHunts = async () => {
    try {
      const today = getTodayLocalDate();
      const { data, error } = await supabase
        .from('hunts')
        .select('*')
        .lte('date', today)
        .order('date', { ascending: false });
      
      if (error) throw error;
      setHunts(data || []);
    } catch (e) {
      console.error('Fetch hunts error:', e);
    }
  };

  const applyFilter = useCallback((allHunts, completedIds, filterCategory) => {
    let filtered = allHunts.filter(h => !completedIds.includes(h.id));
    if (filterCategory !== 'All') filtered = filtered.filter(h => h.category === filterCategory);
    setFilteredHunts(filtered);
  }, []);

  useEffect(() => {
    if (dataLoaded && hunts.length >= 0) {
      applyFilter(hunts, completed, activeFilter);
    }
  }, [activeFilter, dataLoaded, completed, hunts, applyFilter]);

  // ─── SELFIE UPLOAD ─────────────────────────────
  const uploadSelfie = async () => {
    if (!selfieFile || !currentHunt || uploading) return;
    
    // Check if already completed
    if (completed.includes(currentHunt.id)) {
      alert('You have already completed this hunt!');
      setShowModal(false);
      setSelfieFile(null);
      return;
    }

    setUploading(true);
    setError('');
    
    try {
      // Check geolocation permission
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve, 
          (err) => {
            if (err.code === 1) {
              reject(new Error('Location permission denied. Please enable location access.'));
            } else if (err.code === 2) {
              reject(new Error('Location unavailable. Please try again.'));
            } else {
              reject(new Error('Location timeout. Please try again.'));
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });

      const distance = calculateDistance(
        position.coords.latitude,
        position.coords.longitude,
        currentHunt.lat,
        currentHunt.lon
      );

      if (distance > currentHunt.radius) {
        alert(`You are ${Math.round(distance)}m away. You need to be within ${currentHunt.radius}m of the spot!`);
        setUploading(false);
        return;
      }

      // Upload selfie
      const fileExt = selfieFile.name.split('.').pop();
      const fileName = `selfies/${session.user.id}_${currentHunt.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(fileName, selfieFile);
      
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('submissions')
        .getPublicUrl(fileName);

      // Insert selfie record
      const { error: insertError } = await supabase.from('selfies').insert({
        user_id: session.user.id,
        hunt_id: currentHunt.id,
        image_url: publicUrl,
      });

      if (insertError) {
        // Cleanup uploaded file
        await supabase.storage.from('submissions').remove([fileName]);
        throw insertError;
      }

      // Update progress
      const newCompleted = [...new Set([...completed, currentHunt.id])];
      const newTotal = newCompleted.length;

      const today = getTodayLocalDate();
      const yesterday = getYesterdayLocalDate();
      
      let newStreak = 1;
      if (lastActive) {
        if (lastActive === yesterday) {
          newStreak = streak + 1;
        } else if (lastActive === today) {
          newStreak = streak;
        }
      }

      const newTier = newTotal >= 20 ? 'Legend' : newTotal >= 10 ? 'Pro' : newTotal >= 5 ? 'Hunter' : 'Newbie';

      const { error: upsertError } = await supabase.from('user_progress').upsert({
        user_id: session.user.id,
        completed_hunt_ids: newCompleted,
        total_hunts: newTotal,
        streak: newStreak,
        tier: newTier,
        last_active: today,
      }, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;

      setCompleted(newCompleted);
      setTotalHunts(newTotal);
      setStreak(newStreak);
      setTier(newTier);
      setLastActive(today);

      setShowModal(false);
      setSelfieFile(null);
      setCurrentHunt(null);
      
      alert(`Success! Your code is: ${currentHunt.code}`);
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Upload failed. Please try again.');
      alert(error.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ─── LEADERBOARD ────────────────────────────────
  const loadLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('user_id, total_hunts, tier')
        .order('total_hunts', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Get user emails
      const enriched = await Promise.all(
        (data || []).map(async (item) => {
          const { data: userData } = await supabase.auth.admin.getUserById(item.user_id);
          return {
            email: userData?.user?.email || 'Anonymous',
            hunts: item.total_hunts,
            tier: item.tier
          };
        })
      );

      setLeaderboardData(enriched);
    } catch (e) {
      console.error('Leaderboard error:', e);
      setLeaderboardData([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    if (showLeaderboard && leaderboardData.length === 0) {
      loadLeaderboard();
    }
  }, [showLeaderboard]);

  // ─── ADMIN: LOAD DATA ───────────────────────────
  const loadAdminData = async () => {
    try {
      const { data: allHunts, error: huntsError } = await supabase
        .from('hunts')
        .select('*')
        .order('date', { ascending: false });
      
      if (huntsError) throw huntsError;
      setAdminHunts(allHunts || []);

      const { data: subs, error: subsError } = await supabase
        .from('selfies')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (subsError) throw subsError;

      // Enrich with hunt and user data
      const enriched = await Promise.all(
        (subs || []).map(async (sub) => {
          const { data: hunt } = await supabase
            .from('hunts')
            .select('business_name')
            .eq('id', sub.hunt_id)
            .single();
          
          return {
            ...sub,
            hunt_name: hunt?.business_name || 'Unknown',
            user_email: sub.user_id // In production, fetch from auth
          };
        })
      );

      setSubmissions(enriched);
    } catch (e) {
      console.error('Admin load error:', e);
      setError('Failed to load admin data');
    }
  };

  // ─── CREATE NEW HUNT ───────────────────────────
  const createHunt = async () => {
    if (!newHuntBusinessName.trim() || !newHuntRiddle.trim() || !newHuntCode.trim() || !newHuntLat || !newHuntLon) {
      alert('Please fill all required fields (Business Name, Riddle, Code, Latitude, Longitude)');
      return;
    }

    const lat = parseFloat(newHuntLat);
    const lon = parseFloat(newHuntLon);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      alert('Invalid coordinates');
      return;
    }

    setCreatingHunt(true);
    try {
      let photoUrl = null;
      if (newHuntPhoto) {
        const fileExt = newHuntPhoto.name.split('.').pop();
        const fileName = `hunt_${Date.now()}.${fileExt}`;
        const path = `hunts/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('hunts')
          .upload(path, newHuntPhoto);
        
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('hunts')
          .getPublicUrl(path);
        photoUrl = publicUrl;
      }

      const huntDate = newHuntDate || getTodayLocalDate();

      const { error } = await supabase.from('hunts').insert({
        date: huntDate,
        category: newHuntCategory || 'Food & Drink',
        riddle: newHuntRiddle.trim(),
        business_name: newHuntBusinessName.trim(),
        code: newHuntCode.trim(),
        discount: newHuntDiscount.trim(),
        photo: photoUrl,
        lat: lat,
        lon: lon,
        radius: parseInt(newHuntRadius) || 50,
      });

      if (error) throw error;

      alert('Hunt created successfully!');
      setNewHuntDate(''); setNewHuntCategory(''); setNewHuntRiddle(''); 
      setNewHuntBusinessName(''); setNewHuntCode(''); setNewHuntDiscount(''); 
      setNewHuntLat(''); setNewHuntLon(''); setNewHuntRadius('50'); 
      setNewHuntPhoto(null);
      loadAdminData();
      setAdminTab('hunts');
    } catch (err) {
      console.error('Create hunt error:', err);
      alert('Failed to create hunt: ' + (err.message || 'Unknown error'));
    } finally {
      setCreatingHunt(false);
    }
  };

  const approveSelfie = async (id) => {
    setProcessingSubmission(id);
    try {
      const { error } = await supabase.from('selfies').update({ approved: true }).eq('id', id);
      if (error) throw error;
      await loadAdminData();
    } catch (e) {
      console.error('Approve error:', e);
      alert('Failed to approve');
    } finally {
      setProcessingSubmission(null);
    }
  };

  const rejectSelfie = async (id) => {
    if (!confirm('Are you sure you want to reject this submission?')) return;
    
    setProcessingSubmission(id);
    try {
      const { error } = await supabase.from('selfies').delete().eq('id', id);
      if (error) throw error;
      await loadAdminData();
    } catch (e) {
      console.error('Reject error:', e);
      alert('Failed to reject');
    } finally {
      setProcessingSubmission(null);
    }
  };

  const signUp = async () => {
    if (!email.trim() || !password) {
      setAuthError('Please enter email and password');
      return;
    }
    setLoading(true); 
    setAuthError('');
    try {
      const { error } = await supabase.auth.signUp({ 
        email: email.trim(), 
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) throw error;
      alert('Check your email to confirm your account!');
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async () => {
    if (!email.trim() || !password) {
      setAuthError('Please enter email and password');
      return;
    }
    setLoading(true); 
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });
      if (error) throw error;
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!confirm('Are you sure you want to sign out?')) return;
    await supabase.auth.signOut();
    setSession(null);
  };

  // ─── ADMIN PANEL ───────────────────────────────
  if (showAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white shadow-xl p-6 sticky top-0 z-50 flex justify-between items-center">
          <h1 className="text-4xl font-black text-amber-900 flex items-center gap-4">
            <Shield className="text-amber-600" />
            Admin Panel
          </h1>
          <div className="flex gap-4">
            <button onClick={() => setShowAdmin(false)} className="px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-full font-bold transition">
              Back to App
            </button>
            <button onClick={signOut} className="text-gray-600 hover:text-gray-800 transition">
              <LogOut size={28} />
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-8">
          <div className="flex gap-8 mb-12 border-b-4 border-amber-200">
            <button onClick={() => setAdminTab('hunts')} className={`pb-4 px-6 text-2xl font-bold transition ${adminTab === 'hunts' ? 'text-amber-600 border-b-4 border-amber-600' : 'text-gray-600 hover:text-gray-800'}`}>
              All Hunts ({adminHunts.length})
            </button>
            <button onClick={() => setAdminTab('submissions')} className={`pb-4 px-6 text-2xl font-bold transition ${adminTab === 'submissions' ? 'text-amber-600 border-b-4 border-amber-600' : 'text-gray-600 hover:text-gray-800'}`}>
              Pending ({submissions.filter(s => !s.approved).length})
            </button>
            <button onClick={() => setAdminTab('create')} className={`pb-4 px-6 text-2xl font-bold transition ${adminTab === 'create' ? 'text-amber-600 border-b-4 border-amber-600' : 'text-gray-600 hover:text-gray-800'}`}>
              + Create Hunt
            </button>
          </div>

          {/* ACTIVE HUNTS */}
          {adminTab === 'hunts' && (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {adminHunts.map(hunt => (
                <div key={hunt.id} className="bg-white rounded-3xl shadow-2xl overflow-hidden hover:shadow-3xl transition">
                  {hunt.photo && <img src={hunt.photo} alt="" className="w-full h-64 object-cover" />}
                  <div className="p-6">
                    <span className="inline-block px-4 py-1 bg-amber-200 text-amber-800 rounded-full text-xs font-bold mb-3">
                      {hunt.category}
                    </span>
                    <h3 className="text-2xl font-black text-amber-900 mb-2">{hunt.business_name}</h3>
                    <p className="text-gray-600 italic mb-4">"{hunt.riddle}"</p>
                    <p className="text-sm text-gray-700"><strong>Code:</strong> {hunt.code}</p>
                    <p className="text-sm text-gray-700"><strong>Date:</strong> {new Date(hunt.date).toLocaleDateString()}</p>
                    <p className="text-sm text-gray-700"><strong>Radius:</strong> {hunt.radius}m</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUBMISSIONS */}
          {adminTab === 'submissions' && (
            <>
              {submissions.filter(s => !s.approved).length === 0 ? (
                <p className="text-center text-gray-600 text-xl py-12">No pending submissions</p>
              ) : (
                submissions.filter(s => !s.approved).map(sub => (
                  <div key={sub.id} className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row mb-8">
                    <img src={sub.image_url} alt="Selfie" className="w-full lg:w-96 h-96 object-cover" />
                    <div className="p-8 flex-1 flex flex-col justify-center">
                      <p className="text-xl mb-2"><strong>User ID:</strong> {sub.user_id.slice(0, 8)}...</p>
                      <p className="text-xl mb-2"><strong>Hunt:</strong> {sub.hunt_name}</p>
                      <p className="text-sm text-gray-600 mb-8">Submitted: {new Date(sub.created_at).toLocaleString()}</p>
                      <div className="flex gap-6">
                        <button 
                          onClick={() => approveSelfie(sub.id)} 
                          disabled={processingSubmission === sub.id}
                          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition"
                        >
                          <Check size={24} />
                          {processingSubmission === sub.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button 
                          onClick={() => rejectSelfie(sub.id)} 
                          disabled={processingSubmission === sub.id}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition"
                        >
                          <X size={24} />
                          {processingSubmission === sub.id ? 'Processing...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* CREATE HUNT */}
          {adminTab === 'create' && (
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-4xl mx-auto">
              <h2 className="text-4xl font-black text-amber-900 mb-10 text-center">Create New Hunt</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Active From Date</label>
                  <input 
                    type="date" 
                    value={newHuntDate} 
                    onChange={e => setNewHuntDate(e.target.value)} 
                    className="w-full p-5 border-2 border-amber-200 rounded-2xl text-lg focus:border-amber-500 focus:outline-none transition" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                  <select 
                    value={newHuntCategory} 
                    onChange={e => setNewHuntCategory(e.target.value)}
                    className="w-full p-5 border-2 border-amber-200 rounded-2xl text-lg focus:border-amber-500 focus:outline-none transition"
                  >
                    <option value="">Select category</option>
                    <option value="Café">Café</option>
                    <option value="Barber">Barber</option>
                    <option value="Restaurant">Restaurant</option>
                    <option value="Gig">Gig</option>
                    <option value="Museum">Museum</option>
                    <option value="Food & Drink">Food & Drink</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Business Name *</label>
                  <input 
                    type="text" 
                    value={newHuntBusinessName} 
                    onChange={e => setNewHuntBusinessName(e.target.value)} 
                    className="w-full p-5 border-2 border-amber-200 rounded-2xl text-lg focus:border-amber-500 focus:outline-none transition" 
                    placeholder="e.g. Brew Coffee House" 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Riddle / Clue *</label>
                  <textarea 
                    value={newHuntRiddle} 
                    onChange={e => setNewHuntRiddle(e.target.value)} 
                    className="w-full p-5 border-2 border-amber-200 rounded-2xl text-lg h-32 focus:border-amber-500 focus:outline-none transition" 
                    placeholder="Write an intriguing riddle..." 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Secret Code *</label>
                  <input 
                    type="text" 
                    value={newHuntCode} 
                    onChange={e => setNewHuntCode(e.target.value)} 
                    className="w-full p-5 border-2 border-amber-200 rounded-2xl text-lg focus:border-amber-500 focus:outline-none transition" 
                    placeholder="e.g. BREW2025" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Discount / Reward</label>
                  <input 
                    type="text" 
                    value={newHuntDiscount} 
                    onChange={e => setNewHuntDiscount(e.target.value)} 
                    className="w-full p-5 border-2 border-amber-200 rounded-2xl text-lg focus:border-amber-500 focus:outline-none transition" 
                    placeholder="e.g. Free coffee" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Latitude *</label>
                  <input 
                    type="text" 
                    value={newHuntLat} 
                    onChange={e => setNewHuntLat(e.target.value)} 
                    className="w-full p-5 border-2 border-amber-200 rounded-2xl text-lg focus:border-amber-500 focus:outline-none transition" 
                    placeholder="e.g. 51.5074" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Longitude *</label>
                  <input 
                    type="text" 
                    value={newHuntLon} 
                    onChange={e => setNewHuntLon(e.target.value)} 
                    className="w-full p-5 border-2 border-amber-200 rounded-2xl text-lg focus:border-amber-500 focus:outline-none transition" 
                    placeholder="e.g. -0.1278" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Radius (meters)</label>
                  <input 
                    type="number" 
                    value={newHuntRadius} 
                    onChange={e => setNewHuntRadius(e.target.value)} 
                    className="w-full p-5 border-2 border-amber-200 rounded-2xl text-lg focus:border-amber-500 focus:outline-none transition" 
                    placeholder="50" 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Hunt Photo</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={e => setNewHuntPhoto(e.target.files?.[0] || null)} 
                    className="w-full p-5 border-2 border-dashed border-amber-300 rounded-2xl bg-amber-50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-amber-600 file:text-white hover:file:bg-amber-700 file:cursor-pointer" 
                  />
                </div>
              </div>
              <button 
                onClick={createHunt} 
                disabled={creatingHunt} 
                className="mt-10 w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 rounded-2xl font-black text-2xl shadow-xl transition"
              >
                {creatingHunt ? 'Creating...' : 'Create Hunt'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── MAIN APP ───────────────────────────────
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
          
          <input 
            type="email" 
            placeholder="you@example.com" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            className="w-full p-5 mb-4 border-2 border-amber-200 rounded-2xl text-lg focus:border-amber-500 focus:outline-none transition" 
          />
          <input 
            type="password" 
            placeholder="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            onKeyPress={e => e.key === 'Enter' && signIn()}
            className="w-full p-5 mb-8 border-2 border-amber-200 rounded-2xl text-lg focus:border-amber-500 focus:outline-none transition" 
          />
          <button 
            onClick={signUp} 
            disabled={loading} 
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-6 rounded-2xl font-bold text-2xl shadow-lg mb-4 transition"
          >
            {loading ? 'Creating...' : 'Sign Up Free'}
          </button>
          <button 
            onClick={signIn} 
            disabled={loading} 
            className="w-full bg-gray-700 hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed text-white py-6 rounded-2xl font-bold text-2xl shadow-lg transition"
          >
            {loading ? 'Signing In...' : 'Log In'}
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
              <button 
                onClick={() => setShowAdmin(true)} 
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg transition"
              >
                <Shield size={20} />
                Admin
              </button>
            )}
            <button onClick={signOut} className="text-gray-600 hover:text-gray-800 transition">
              <LogOut size={28} />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-md mx-auto px-6 pt-6">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={20} />
            <div className="flex-1">
              <p className="text-red-700">{error}</p>
              <button 
                onClick={() => setError('')} 
                className="text-red-800 underline text-sm mt-1 font-bold"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
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
                className="text-xl underline text-gray-700 hover:text-gray-900 transition"
              >
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
            <button 
              key={cat} 
              onClick={() => setActiveFilter(cat)} 
              className={`px-6 py-3 rounded-full font-bold transition shadow-lg ${
                activeFilter === cat 
                  ? 'bg-amber-600 text-white scale-105' 
                  : 'bg-white text-gray-700 hover:bg-amber-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="text-center mb-8">
          <button 
            onClick={() => setShowLeaderboard(true)} 
            className="text-amber-700 underline font-bold text-xl flex items-center gap-2 mx-auto hover:text-amber-900 transition"
          >
            <Trophy size={24} />
            Leaderboard
          </button>
        </div>

        {/* Hunts */}
        <div className="space-y-8 pb-24">
          {filteredHunts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl shadow-xl p-8">
              <p className="text-gray-600 text-xl mb-4">
                No {activeFilter === 'All' ? '' : activeFilter} hunts available right now
              </p>
              <p className="text-gray-500">Check back soon for new adventures!</p>
            </div>
          ) : (
            filteredHunts.map(hunt => (
              <div key={hunt.id} className="bg-white rounded-3xl shadow-2xl overflow-hidden hover:shadow-3xl transition">
                <div className="relative">
                  <img 
                    src={hunt.photo || "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"} 
                    alt="Hunt location" 
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
                    <p className="text-lg text-green-600 font-semibold mb-8">🎁 {hunt.discount}</p>
                  )}
                  <button 
                    onClick={() => { 
                      setCurrentHunt(hunt); 
                      setShowModal(true); 
                    }} 
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-2xl font-black text-2xl shadow-xl transition"
                  >
                    I'm at the spot!
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Completed Hunts Modal */}
      {showCompletedModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowCompletedModal(false)} 
              className="absolute top-6 right-6 text-4xl text-gray-500 hover:text-gray-700 transition"
            >
              &times;
            </button>
            <Trophy className="w-16 h-16 text-amber-600 mx-auto mb-6" />
            <h2 className="text-4xl font-black text-amber-900 mb-10">Your Completed Hunts ({totalHunts})</h2>
            {completedHunts.length === 0 ? (
              <p className="text-gray-600 text-xl">No completed hunts yet — get hunting!</p>
            ) : (
              <div className="space-y-8">
                {completedHunts.map(hunt => (
                  <div key={hunt.id} className="bg-gray-50 rounded-2xl p-6 text-left">
                    <img 
                      src={hunt.photo || "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop"} 
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

      {/* Selfie Modal */}
      {showModal && currentHunt && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center relative">
            <button 
              onClick={() => { 
                setShowModal(false); 
                setSelfieFile(null); 
                setCurrentHunt(null);
              }} 
              className="absolute top-6 right-6 text-4xl text-gray-500 hover:text-gray-700 transition"
            >
              &times;
            </button>
            <h3 className="text-4xl font-black text-gray-800 mb-4">Show the logo!</h3>
            <p className="text-xl text-gray-600 mb-2">Take a selfie with the business logo</p>
            <p className="text-lg text-amber-600 font-bold mb-10">Win £50 weekly for best selfie!</p>
            
            {selfieFile && (
              <div className="mb-6 p-4 bg-green-50 rounded-2xl">
                <p className="text-green-700 font-semibold">✓ Photo ready!</p>
              </div>
            )}
            
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              onChange={e => setSelfieFile(e.target.files?.[0] || null)} 
              className="hidden" 
              id="camera" 
            />
            <label 
              htmlFor="camera" 
              className="w-44 h-44 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center shadow-2xl text-5xl cursor-pointer mx-auto mb-12 transition hover:scale-105"
            >
              <span className="text-2xl font-bold">📸 Camera</span>
            </label>
            <button 
              onClick={uploadSelfie} 
              disabled={!selfieFile || uploading} 
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-6 rounded-2xl font-black text-2xl shadow-xl transition"
            >
              {uploading ? 'Uploading...' : 'Submit & Unlock Code'}
            </button>
            <p className="text-sm text-gray-500 mt-4">
              Location will be verified automatically
            </p>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center relative">
            <button 
              onClick={() => setShowLeaderboard(false)} 
              className="absolute top-6 right-6 text-4xl text-gray-500 hover:text-gray-700 transition"
            >
              &times;
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
                      idx === 0 ? 'bg-amber-100' : idx === 1 ? 'bg-gray-100' : idx === 2 ? 'bg-orange-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-3xl font-black text-gray-700">#{idx + 1}</span>
                        <div>
                          <p className="font-bold text-xl text-gray-800">
                            {user.email.split('@')[0]}
                          </p>
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


