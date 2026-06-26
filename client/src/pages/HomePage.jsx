import React, { useLayoutEffect, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import LogoWithText from "../pages/LogoWithText";

// Import instrument images
import drumsImg from "../assets/photos/drums.png";
import fluteImg from "../assets/photos/flute.png";
import guitarImg from "../assets/photos/guitar.png";
import tablaImg from "../assets/photos/tabla.png";
import harmoniumImg from "../assets/photos/harmonium.png";
import saxophoneImg from "../assets/photos/saxophone.png";
import keyboardImg from "../assets/photos/keyboard.png";
import violinImg from "../assets/photos/violin.png";

// Import audio files
import drumsAudio from "../assets/audio/drums.mp3";
import fluteAudio from "../assets/audio/flute.mp3";
import guitarAudio from "../assets/audio/guitar.mp3";
import tablaAudio from "../assets/audio/tabla.wav";
import harmoniumAudio from "../assets/audio/harmonium.wav";
import saxophoneAudio from "../assets/audio/saxophone.wav";
import keyboardAudio from "../assets/audio/keyboard.wav";
import violinAudio from "../assets/audio/violin.mp3";

// Array of instruments with images and audio paths
const instruments = [
  {
    name: "drums",
    image: drumsImg,
    virtualLink:
      "https://www.sessiontown.com/en/music-games-apps/virtual-instrument-play-drums-online",
    audio: drumsAudio,
  },
  {
    name: "flute",
    image: fluteImg,
    virtualLink: "https://www.virtualmusicalinstruments.com/flute",
    audio: fluteAudio,
  },
  {
    name: "guitar",
    image: guitarImg,
    virtualLink: "https://www.musicca.com/guitar",
    audio: guitarAudio,
  },
  {
    name: "tabla",
    image: tablaImg,
    virtualLink: "https://artiumacademy.com/tools/tabla",
    audio: tablaAudio,
  },
  {
    name: "harmonium",
    image: harmoniumImg,
    virtualLink: "https://music-tools.spardhaschoolofmusic.com/harmonium",
    audio: harmoniumAudio,
  },
  {
    name: "saxophone",
    image: saxophoneImg,
    virtualLink: "https://www.trumpetfingering.com/virtual-saxophone",
    audio: saxophoneAudio,
  },
  {
    name: "keyboard",
    image: keyboardImg,
    virtualLink:
      "https://www.sessiontown.com/en/music-games-apps/online-virtual-keyboard-piano",
    audio: keyboardAudio,
  },
  {
    name: "violin",
    image: violinImg,
    virtualLink: "https://www.ecarddesignanimation.com/home/violin_html5.php",
    audio: violinAudio,
  },
];

const HomePage = () => {
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const cardRefs = useRef([]);
  const audioRefs = useRef({}); // Lazily created audio elements

  useLayoutEffect(() => {
    cardRefs.current = cardRefs.current.slice(0, instruments.length);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current,
        { autoAlpha: 0, y: -20 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          force3D: true,
        }
      );

      gsap.fromTo(
        cardRefs.current,
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: "power2.out",
          force3D: true,
        }
      );
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    // Stop all audio on component unmount
    return () => {
      const currentAudioRefs = audioRefs.current;
      Object.values(currentAudioRefs).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50" style={{width: '100%', maxWidth: 'none'}}>
      {/* Modern Header with Glass Effect */}
      <header
        ref={headerRef}
        className="sticky top-0 z-50 opacity-0 -translate-y-10 bg-white/80 backdrop-blur-lg border-b border-gray-200/50 shadow-sm"
      >
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4" style={{width: '100%', maxWidth: 'none'}}>
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="cursor-pointer hover:scale-105 transition-transform" onClick={() => navigate("/")}>
              <LogoWithText />
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-2">
              <button
                onClick={() => navigate("/audio-rooms")}
                className="group relative px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-green-600 transition-colors rounded-lg hover:bg-green-50"
              >
                <span className="flex items-center gap-2">
                  🎤 <span>Audio Rooms</span>
                </span>
              </button>
              <button
                onClick={() => navigate("/social-feed")}
                className="group relative px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
              >
                <span className="flex items-center gap-2">
                  🌟 <span>Social Feed</span>
                </span>
              </button>
              <button
                onClick={() => navigate("/courses")}
                className="group relative px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-orange-600 transition-colors rounded-lg hover:bg-orange-50"
              >
                <span className="flex items-center gap-2">
                  📚 <span>Courses</span>
                </span>
              </button>
              <div className="w-px h-6 bg-gray-300 mx-2"></div>
              <button
                onClick={() => navigate("/add-resource")}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg shadow-md hover:shadow-lg transition-all"
              >
                + Add Resource
              </button>
              <button
                onClick={() => navigate("/manage-resources")}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-purple-700 border border-gray-300 hover:border-purple-400 rounded-lg transition-colors hover:bg-purple-50"
              >
                Manage
              </button>
              <button
                onClick={() => navigate("/profile")}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-purple-700 border border-gray-300 hover:border-purple-400 rounded-lg transition-colors hover:bg-purple-50"
              >
                Profile
              </button>
            </nav>

            {/* Mobile Menu Button - Could be expanded in future */}
            <div className="lg:hidden flex items-center gap-2">
              <button
                onClick={() => navigate("/profile")}
                className="p-2 text-gray-700 hover:text-purple-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="lg:hidden mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate("/audio-rooms")}
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-green-600 bg-green-50 rounded-lg transition-colors"
            >
              🎤 Audio Rooms
            </button>
            <button
              onClick={() => navigate("/social-feed")}
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 bg-blue-50 rounded-lg transition-colors"
            >
              🌟 Social Feed
            </button>
            <button
              onClick={() => navigate("/courses")}
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 bg-orange-50 rounded-lg transition-colors"
            >
              📚 Courses
            </button>
            <button
              onClick={() => navigate("/add-resource")}
              className="px-3 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg"
            >
              + Add Resource
            </button>
            <button
              onClick={() => navigate("/manage-resources")}
              className="px-3 py-2 text-sm font-medium text-purple-700 border border-purple-300 rounded-lg"
            >
              Manage
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="px-3 py-2 text-sm font-medium text-purple-700 border border-purple-300 rounded-lg"
            >
              Profile
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-12 pb-8" style={{width: '100%', maxWidth: 'none'}}>
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-4">
            🎵 Choose Your Instrument
          </h1>
          <p className="text-lg text-gray-600 w-full">
            Explore resources, learn from experts, and master your favorite instrument
          </p>
        </div>

        {/* Instrument Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {instruments.map((instrument, index) => {
            const handleMouseEnter = () => {
              if (!audioRefs.current[instrument.name]) {
                const audio = new Audio(instrument.audio);
                audio.preload = "auto";
                audioRefs.current[instrument.name] = audio;
              }
              const audio = audioRefs.current[instrument.name];
              audio.currentTime = 0;
              audio.play().catch(() => {});
            };

            const handleMouseLeave = () => {
              const audio = audioRefs.current[instrument.name];
              if (audio) {
                audio.pause();
                audio.currentTime = 0;
              }
            };

            return (
              <div
                key={instrument.name}
                ref={(el) => (cardRefs.current[index] = el)}
                className="group opacity-0 translate-y-6"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <div className="relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 cursor-pointer transform hover:-translate-y-2"
                  onClick={() => navigate(`/instrument/${instrument.name}`)}
                >
                  {/* Image Container with Gradient Overlay */}
                  <div className="relative h-48 sm:h-56 bg-gradient-to-br from-purple-100 via-pink-100 to-indigo-100 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <img
                      src={instrument.image}
                      alt={instrument.name}
                      className="h-full object-contain p-6 transform group-hover:scale-110 transition-transform duration-500"
                    />
                    {/* Floating Badge */}
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-purple-600 shadow-md">
                      Popular
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-6" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-xl font-bold capitalize text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
                      {instrument.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                      Explore resources, tutorials and start your musical journey
                    </p>

                    {/* Action Button */}
                    <button
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 group/btn"
                      onClick={() => window.open(instrument.virtualLink, "_blank")}
                    >
                      <span>Try Virtual {instrument.name.charAt(0).toUpperCase() + instrument.name.slice(1)}</span>
                      <svg className="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>

                  {/* Bottom Accent Line */}
                  <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
