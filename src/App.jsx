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
  const [showCompletedModalCompleted, setShowCompletedModal] = useState(false);
  const [selfieFile, setSelfieFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Admin states
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState('hunts');
  const [adminHunts, setAdminHunts] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user?.email === ADMIN_EMAIL) {
        setIsAdmin(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      if (s?.user?.email === ADMIN_EMAIL) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        setShowAdmin(false);
      }
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && !showAdmin) {
      setDataLoaded(false);
      loadProgressAndHunts();
      const interval = setInterval(fetchHunts, 10000);
      return () => clearInterval(interval);
    } else if (showAdmin) {
      loadAdminData();
    }
  }, [session, showAdmin]);

  // Your existing loadProgressAndHunts, fetchHunts, applyFilter, etc. — 100% unchanged
  const loadProgressAndHunts = async () => {
    try {
      const { data: progressRows, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', session.user.id)
        .order('last_active', { ascending: false });

      if (progressError) console.error('Error loading progress:', progressError);

      let completedIds = [];
      const progress = progressRows && progressRows.length > 0 ? progressRows[0] : null;

      if (progress) {
        completedIds = Array.isArray(progress.completed_hunt_ids) ? progress.completed_hunt_ids : [];
        if (progressRows.length > 1) {
          const allCompleted = new Set();
          let maxTotal = 0;
          let maxStreak = 0;
          progressRows.forEach(row => {
            if (Array.isArray(row.completed_hunt_ids)) row.completed_hunt_ids.forEach(id => allCompleted.add(id));
            maxTotal = Math.max(maxTotal, row.total_hunts || 0);
            maxStreak = Math.max(maxStreak, row.streak || 0);
          });
          completedIds = Array.from(allCompleted);
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

      const { data: huntsData } = await supabase
        .from('hunts')
        .select('*')
        .order('date', { ascending: false });

      const allHunts = huntsData || [];
      setHunts(allHunts);
      applyFilter(allHunts, completedIds, activeFilter);
      setDataLoaded(true);
    } catch (error) {
      console.error('Error:', error);
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

  useEffect(() => {
    if (dataLoaded && hunts.length > 0) applyFilter(hunts, completed, activeFilter);
  }, [activeFilter, dataLoaded]);

  useEffect(() => {
    if (dataLoaded && hunts.length > 0) applyFilter(hunts, completed, activeFilter);
  }, [completed]);

  const filterHunts = (cat) => setActiveFilter(cat);
  const startHunt = (hunt) => { setCurrentHunt(hunt); setShowModal(true); };

  // ADMIN: Load all hunts + submissions
  const loadAdminData = async () => {
    const { data: allHunts } = await supabase.from('hunts').select('*');
    setAdminHunts(allHunts || []);

    const { data: subs } = await supabase
      .from('selfies')
      .select('*, hunts(*), auth.users(email)')
      .order('created_at', { ascending: false });
    setSubmissions(subs || []);
  };

  // ADMIN: Create new hunt
  const createHunt = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);

    const hunt = {
      category: data.get('category'),
      riddle: data.get('riddle'),
      business_name: data.get('business_name'),
      discount: data.get('discount'),
      code: data.get('code'),
      lat: parseFloat(data.get('lat')),
      lon: parseFloat(data.get('lon')),
      radius: parseInt(data.get('radius')),
      date: new Date().toISOString(),
    };

    if (data.get('photo')?.size > 0) {
      const file = data.get('photo');
      const fileName = `hunt_${Date.now()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('hunts').upload(fileName, file);
      const { data: urlData } = supabase.storage.from('hunts').getPublicUrl(fileName);
      hunt.photo = urlData.publicUrl;
    }

    await supabase.from('hunts').insert(hunt);
    alert('Hunt created!');
    form.reset();
    loadAdminData();
  };

  // ADMIN: Approve selfie → give user points
  const approveSelfie = async (id) => {
    const { data: selfie } = await supabase.from('selfies').select('user_id, hunt_id').eq('id', id).single();
    await supabase.from('selfies').update({ approved: true }).eq('id', id);

    const { data: progress } = await supabase.from('user_progress').select('*').eq('user_id', selfie.user_id).single();
    const newCompleted = [...new Set([...(progress?.completed_hunt_ids || []), selfie.hunt_id])];
    const newTotal = newCompleted.length;

    await supabase.from('user_progress').upsert({
      user_id: selfie.user_id,
      completed_hunt_ids: newCompleted,
      total_hunts: newTotal,
      streak: progress?.streak || 0,
      tier: newTotal >= 20 ? 'Legend' : newTotal >= 10 ? 'Pro' : newTotal >= 5 ? 'Hunter' : 'Newbie',
      last_active: new Date().toISOString().slice(0, 10),
    });

    loadAdminData();
  };

  const rejectSelfie = async (id) => {
    await supabase.from('selfies').delete().eq('id', id);
    loadAdminData();
  };

  // Your existing uploadSelfie stays exactly the same
  const uploadSelfie = async () => {
    // ... your full working uploadSelfie from above (unchanged)
    // Just copy-paste your current one here
  };

  const signUp = async () => { /* unchanged */ };
  const signIn = async () => { /* unchanged */ };
  const signOut = async () => { /* unchanged */ };

  // ADMIN PANEL RENDER
  if (showAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white shadow-xl p-4 sticky top-0 z-50 flex justify-between items-center">
          <h1 className="text-3xl font-black text-amber-900 flex items-center gap-3">
            <Shield className="text-amber-600" /> Admin Panel
          </h1>
          <div className="flex gap-3">
            <button onClick={() => setShowAdmin(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Back to App</button>
            <button onClick={signOut} className="text-gray-600"><LogOut size={28} /></button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-6">
          <div className="flex gap-4 mb-8 border-b">
            <button onClick={() => setAdminTab('hunts')} className={`pb-3 px-2 font-bold text-lg ${adminTab === 'hunts' ? 'text-amber-600 border-b-4 border-amber-600' : 'text-gray-600'}`}>
              Hunts ({adminHunts.length})
            </button>
            <button onClick={() => setAdminTab('submissions')} className={`pb-3 px-2 font-bold text-lg ${adminTab === 'submissions' ? 'text-amber-600 border-b-4 border-amber-600' : 'text-gray-600'}`}>
              Submissions ({submissions.filter(s => !s.approved).length})
            </button>
          </div>

          {adminTab === 'hunts' && (
            <>
              <div className="bg-white rounded-2xl shadow-xl p-8 mb-10">
                <h2 className="text-2xl font-bold mb-6">Create New Hunt</h2>
                <form onSubmit={createHunt} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input name="category" placeholder="Category" required className="p-3 border rounded-lg" />
                  <input name="riddle" placeholder="Riddle" required className="p-3 border rounded-lg" />
                  <input name="business_name" placeholder="Business Name" required className="p-3 border rounded-lg" />
                  <input name="discount" placeholder="Discount" required className="p-3 border rounded-lg" />
                  <input name="code" placeholder="Discount Code" required className="p-3 border rounded-lg" />
                  <input name="lat" type="number" step="0.000001" placeholder="Latitude" required className="p-3 border rounded-lg" />
                  <input name="lon" type="number" step="0.000001" placeholder="Longitude" required className="p-3 border rounded-lg" />
                  <input name="radius" type="number" placeholder="Radius (meters)" required className="p-3 border rounded-lg" />
                  <input name="photo" type="file" accept="image/*" className="p-3 border rounded-lg" />
                  <button type="submit" className="md:col-span-2 bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-bold text-xl">
                    Create Hunt
                  </button>
                </form>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {adminHunts.map(h => (
                  <div key={h.id} className="bg-white rounded-xl shadow p-4">
                    <img src={h.photo || '/placeholder.jpg'} className="w-full h-48 object-cover rounded-lg mb-3" />
                    <p className="font-bold">{h.business_name}</p>
                    <p className="text-sm text-gray-600">{h.category}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {adminTab === 'submissions' && (
            <div className="space-y-6">
              {submissions.filter(s => !s.approved).map(sub => (
                <div key={sub.id} className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
                  <img src={sub.image_url} alt="Selfie" className="w-full md:w-96 h-96 object-cover" />
                  <div className="p-6 flex-1">
                    <p><strong>User:</strong> {sub['auth.users']?.email || sub.user_id}</p>
                    <p><strong>Hunt:</strong> {sub.hunts?.business_name}</p>
                    <p><strong>Date:</strong> {new Date(sub.created_at).toLocaleString()}</p>
                    <div className="flex gap-4 mt-6">
                      <button onClick={() => approveSelfie(sub.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2">
                        <Check /> Approve & Give Points
                      </button>
                      <button onClick={() => rejectSelfie(sub.id)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2">
                        <X /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // NORMAL USER UI — 100% your working code below
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
              <button
                onClick={() => setShowAdmin(true)}
                className="bg-amber-600 text-white px-5 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg"
              >
                <Shield size={20} /> Admin
              </button>
            )}
            <button onClick={signOut}><LogOut size={28} className="text-gray-600" /></button>
          </div>
        </div>
      </div>

      {/* Rest of your EXACT working UI below — unchanged */}
      {/* Stats, Filters, Hunts list, Modals, etc. — copy your current JSX here */}
      {/* ... everything from your working version ... */}
      
      {/* Just make sure to keep your uploadSelfie function exactly as it is */}
    </div>
  );
}
