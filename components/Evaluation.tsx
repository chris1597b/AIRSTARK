import React from 'react';

interface EvaluationProps {
  onExit: () => void;
}

export const Evaluation: React.FC<EvaluationProps> = ({ onExit }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 flex">
      {/* SideNavBar (Desktop Only) */}
      <nav className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-white/10 z-40">
        <div className="p-6 border-b border-white/10 h-16 flex items-center justify-between">
          <div className="text-2xl font-bold text-cyan-400">
            AIRSTARK
          </div>
          <button onClick={onExit} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white" title="Volver">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        </div>
        <div className="p-6 flex items-center gap-4 border-b border-white/10">
          <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden border border-white/10">
            <img 
              alt="Teacher Profile" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCN-wfwsESke75JMPQJFybEXNj2F-us_WAPc0BZETnOVPjwiENbngQv1s2Egmqb3L5Pzo_APAIFMGZYqZU0xe1nMm_QtDHc5cyaej9ci88TDG-GIl63Dx3OSfJ7HZcCpcdNz3c4JYiYeI009Eoi6b6ciyauK9-k5xvuDCICv42GPapOG0hXGBkS8jx4gqPtreWxDUJ3H_kS54KK3N7cMUyWWBzMNWG0lK22_7TtENq7kVqnPuwcCks-aS6A8IVQnVO5HAbRFIqETlRI" 
            />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Dr. Miller</h3>
            <p className="text-xs text-gray-400">Instructor Principal</p>
          </div>
        </div>
        <div className="flex flex-col py-4">
          <a className="flex items-center gap-4 px-6 py-3 text-cyan-400 font-bold bg-white/5 border-r-2 border-cyan-400 transition-transform duration-150 ease-in-out" href="#">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>space_dashboard</span>
            <span className="text-sm font-semibold">Panel</span>
          </a>
          <a className="flex items-center gap-4 px-6 py-3 text-gray-400 hover:bg-white/5 transition-transform duration-150 ease-in-out" href="#">
            <span className="material-symbols-outlined">monitor_heart</span>
            <span className="text-sm font-semibold">Procedimientos</span>
          </a>
          <a className="flex items-center gap-4 px-6 py-3 text-gray-400 hover:bg-white/5 transition-transform duration-150 ease-in-out" href="#">
            <span className="material-symbols-outlined">3d_rotation</span>
            <span className="text-sm font-semibold">Anatomía</span>
          </a>
          <a className="flex items-center gap-4 px-6 py-3 text-gray-400 hover:bg-white/5 transition-transform duration-150 ease-in-out" href="#">
            <span className="material-symbols-outlined">query_stats</span>
            <span className="text-sm font-semibold">Estadísticas</span>
          </a>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 w-full lg:ml-64 bg-gray-900 overflow-y-auto pt-12 pb-12 px-8 flex flex-col">
        <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col">
          {/* Header Section */}
          <div className="flex justify-between items-end mb-12">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Panel de Profesor</h1>
              <p className="text-lg text-gray-400">Gestiona tus simulaciones médicas en realidad aumentada.</p>
            </div>
          </div>

          {/* Dashboard Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
            {/* Primary Action Area */}
            <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
              {/* Main CTA Card */}
              <div className="bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-xl p-8 flex flex-col justify-center items-center text-center relative overflow-hidden group min-h-[300px]">
                {/* Abstract Background Graphic */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <div className="absolute w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[100px] -top-1/2 -right-1/4 mix-blend-screen transition-opacity group-hover:opacity-40 duration-700"></div>
                </div>
                <div className="relative z-10 w-full max-w-md flex flex-col items-center">
                  <span className="material-symbols-outlined text-6xl text-cyan-400 mb-6" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                  <button className="w-full h-16 bg-cyan-400 text-gray-900 text-sm font-bold rounded-lg flex items-center justify-center gap-3 hover:bg-indigo-600 hover:text-white transition-colors duration-300 shadow-[0_0_15px_rgba(0,255,255,0.4)] active:scale-95">
                    <span className="material-symbols-outlined">cast</span>
                    Crear Nueva Sesión AR
                  </button>
                  <p className="mt-6 text-sm text-gray-400 max-w-xs mx-auto">
                    Proyecta el código QR en clase para que los estudiantes entren
                  </p>
                </div>
              </div>

              {/* Secondary Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Active Sessions */}
                <div className="bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-xl p-6 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center border border-indigo-600/30">
                      <span className="material-symbols-outlined text-indigo-500">sensors</span>
                    </div>
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider rounded border border-green-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                      Live
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1 font-bold">Sesiones Activas Hoy</p>
                    <h2 className="text-4xl font-bold text-white">2</h2>
                  </div>
                </div>

                {/* Students Connected */}
                <div className="bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-xl p-6 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-full bg-slate-700/40 flex items-center justify-center border border-white/10">
                      <span className="material-symbols-outlined text-gray-400">groups</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1 font-bold">Estudiantes Conectados</p>
                    <h2 className="text-4xl font-bold text-white">48</h2>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar / Quick Actions List */}
            <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
              <div className="bg-slate-800/60 backdrop-blur-xl border border-white/10 rounded-xl p-6 h-full flex flex-col">
                <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                  <span className="material-symbols-outlined text-cyan-400">history</span>
                  Sesiones Recientes
                </h3>
                <div className="flex flex-col gap-4 flex-1">
                  {/* Session Item 1 */}
                  <div className="p-4 rounded-lg bg-slate-700/50 border border-white/10 hover:bg-slate-600/50 transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">Anatomía Cardíaca</h4>
                      <span className="text-xs text-gray-400">Ayer</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-gray-400">
                        <span className="material-symbols-outlined text-[16px]">groups</span>
                        <span className="text-xs">24</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400">
                        <span className="material-symbols-outlined text-[16px]">timer</span>
                        <span className="text-xs">45m</span>
                      </div>
                    </div>
                  </div>

                  {/* Session Item 2 */}
                  <div className="p-4 rounded-lg bg-slate-700/50 border border-white/10 hover:bg-slate-600/50 transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">Neurocirugía Básica</h4>
                      <span className="text-xs text-gray-400">Mar 12</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-gray-400">
                        <span className="material-symbols-outlined text-[16px]">groups</span>
                        <span className="text-xs">18</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400">
                        <span className="material-symbols-outlined text-[16px]">timer</span>
                        <span className="text-xs">1h 15m</span>
                      </div>
                    </div>
                  </div>
                </div>
                <button className="w-full py-3 mt-4 text-center text-cyan-400 text-sm font-semibold border border-cyan-400/30 rounded-lg hover:bg-indigo-600/20 hover:text-cyan-300 transition-colors">
                  Ver Historial Completo
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
