import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LogOut, Trophy } from 'lucide-react';

const supabaseUrl = 'https://eeboxlitezqgjyrnssgx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlYm94bGl0ZXpxZ2p5cm5zc2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjcyNTksImV4cCI6MjA4MDI0MzI1OX0.8VlGLHjEv_0aGWOjiDuLLziOCnUqciIAEWayMUGsXT8';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const [currentHunt, setCurrentHunt] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [selfieFile, setSelfieFile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadProgress();
      fetchHunts();
      const interval = setInterval(fetchHunts, 5000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const loadProgress = async () => {
    const { data } = await supabase.from('user_progress').select('*').eq('user_id', session.user.id).single();
    if (data) {
      setCompleted(data.completed_hunt_ids || []);
      setStreak(data.streak || 0);
      setTotalHunts(data.total_hunts || 0);
      setTier(data.tier || 'Newbie');
    }
  };

  const fetchHunts = async () => {
    const { data } = await supabase.from('hunts').select('*').order('date', { ascending: false });
    setHunts(data || []);
    applyFilter(data || []);
  };

  const applyFilter = (allHunts) => {
    let filtered = allHunts.filter(h => !completed.includes(h.id)); // FIXED: hide completed

    if (activeFilter !== 'All') {
      filtered = filtered.filter(h => h.category === activeFilter);
    }

    setFilteredHunts(filtered);
  };

  const filterHunts = (cat) => {
    setActiveFilter(cat);
    applyFilter(hunts);
  };

  const startHunt = (hunt) => {
    setCurrentHunt(hunt);
    setShowModal(true);
  };

  const uploadSelfie = async () => {
    if (!selfieFile || !currentHunt) return;

    try {
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
      const newStreak = currentHunt.date === today ? streak + 1 : 1;
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
      setShowModal(false);
      setSelfieFile(null);
      setCurrentHunt(null);

      // FIXED: Re-apply filter to hide the newly completed hunt
      applyFilter(hunts);
    } catch (error) {
      alert('Upload failed: ' + error.message);
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

  const signOut = () => supabase.auth.signOut();

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

  const activeHunts = hunts.length - completed.length;
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
                {totalHunts} completed · {activeHunts} active
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
            filteredHunts.map(hunt => {
              return (
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
              );
            })
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
                    <p className="text-green-600 font-black text-lg">CODE: {hunt.code}</p>
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
            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-4xl text-gray-500">&times;</button>
            <h3 className="text-4xl font-black text-gray-800 mb-6">Show the logo!</h3>
            <p className="text-xl text-gray-600 mb-10">Win £50 weekly for best selfie!</p>
            <input type="file" accept="image/*" capture="environment" onChange={e => setSelfieFile(e.target.files[0])} className="hidden" id="camera" />
            <label htmlFor="camera" className="w-44 h-44 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center shadow-2xl text-5xl cursor-pointer mx-auto mb-12">
              <span className="text-2xl font-bold">Camera</span>
            </label>
            <button onClick={uploadSelfie} disabled={!selfieFile} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-6 rounded-2xl font-black text-2xl shadow-xl">
              Submit & Unlock
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