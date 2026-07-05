import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { getPosts } from '../firebase';
import { Hash, Search, ArrowLeft, TrendingUp, Flame } from 'lucide-react';

const HashtagsPage = () => {
  const navigate = useNavigate();
  const [hashtags, setHashtags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();
    loadHashtags(abortController.signal);
    return () => abortController.abort();
  }, []);

  const loadHashtags = async (signal) => {
    try {
      setLoading(true);
      const posts = await getPosts();

      if (signal?.aborted) return;

      const counts = {};
      posts.forEach((post) => {
        const matches = post.content?.match(/#[\w]+/g);
        if (matches) {
          matches.forEach((tag) => {
            const normalized = tag.toLowerCase();
            counts[normalized] = (counts[normalized] || 0) + 1;
          });
        }
      });

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({ tag, count }));

      if (!signal?.aborted) {
        setHashtags(sorted);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading hashtags:', error);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const filteredHashtags = useMemo(() => {
    const q = searchTerm.trim().toLowerCase().replace(/^#/, '');
    if (!q) return hashtags;
    return hashtags.filter((item) => item.tag.substring(1).includes(q));
  }, [hashtags, searchTerm]);

  const topTag = hashtags[0];

  const handleSelectHashtag = (tag) => {
    navigate('/home', { state: { hashtagFilter: tag } });
  };

  return (
    <>
      <Helmet>
        <title>Discover Hashtags | InstruMentor</title>
        <meta name="description" content="Browse and search trending hashtags on InstruMentor." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-neutral-950 to-zinc-950 text-white" style={{ width: '100%', maxWidth: 'none' }}>
        <header className="sticky top-0 z-50 bg-zinc-950/85 backdrop-blur-2xl border-b border-white/5">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <div className="h-16 sm:h-20 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => navigate('/home')}
                  className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-zinc-200 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="hidden sm:inline text-sm font-semibold">Back</span>
                </button>
                <div className="h-10 w-10" />
              </div>

              <div className="pb-5">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Discover hashtags</h1>
                <p className="mt-1 text-sm text-zinc-400">See what's trending and find posts by topic.</p>

                <div className="mt-4 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search hashtags"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-zinc-900 border border-sky-300/20 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400/50 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="mx-auto max-w-7xl">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-3xl border border-sky-300/20 bg-zinc-900/70 backdrop-blur-2xl overflow-hidden p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 rounded-2xl bg-white/10 animate-pulse" />
                      <div className="flex-1 min-w-0">
                        <div className="h-4 w-2/3 rounded bg-white/10 animate-pulse" />
                        <div className="mt-2 h-3 w-1/3 rounded bg-white/10 animate-pulse" />
                      </div>
                    </div>
                    <div className="mt-4 h-1.5 w-full rounded-full bg-white/10 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : filteredHashtags.length === 0 ? (
              <div className="text-center py-16 rounded-3xl border border-sky-300/20 bg-zinc-900/70">
                <div className="mx-auto h-16 w-16 rounded-3xl bg-sky-500/10 border border-sky-300/20 flex items-center justify-center">
                  <Hash className="w-8 h-8 text-sky-200" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-zinc-100">No hashtags found</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {searchTerm ? 'Try a different search term.' : 'Hashtags from posts will show up here.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredHashtags.map((item) => (
                  <div
                    key={item.tag}
                    onClick={() => handleSelectHashtag(item.tag)}
                    className="group relative rounded-3xl border border-sky-300/20 bg-zinc-900/70 backdrop-blur-2xl overflow-hidden cursor-pointer hover:border-sky-300/40 transition-colors p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-800 border border-sky-400/30 flex items-center justify-center">
                        <Hash className="w-6 h-6 text-sky-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-zinc-50 truncate">
                          {item.tag.substring(1)}
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {item.count} {item.count === 1 ? 'post' : 'posts'}
                        </p>
                      </div>
                      {topTag && item.tag === topTag.tag && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-orange-300/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
                          <Flame className="w-3.5 h-3.5" />
                          Top
                        </span>
                      )}
                    </div>

                    <div className="mt-4 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-300 via-blue-300 to-cyan-300"
                        style={{ width: `${Math.min(100, (item.count / Math.max(1, topTag?.count || item.count)) * 100)}%` }}
                      />
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs text-sky-300 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      <TrendingUp className="w-3.5 h-3.5" />
                      View posts
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default HashtagsPage;